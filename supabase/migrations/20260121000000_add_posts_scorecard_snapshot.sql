-- Add scorecard_snapshot JSONB column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS scorecard_snapshot JSONB DEFAULT NULL;

-- Add round_id column to posts if it doesn't exist (for linking posts to rounds)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL;

-- Add constraint to ensure scorecard_snapshot is always a JSON object (not array)
-- This prevents invalid JSON array errors
ALTER TABLE public.posts
DROP CONSTRAINT IF EXISTS check_scorecard_snapshot_is_object;

ALTER TABLE public.posts
ADD CONSTRAINT check_scorecard_snapshot_is_object
CHECK (
  scorecard_snapshot IS NULL OR 
  (jsonb_typeof(scorecard_snapshot) = 'object' AND scorecard_snapshot ? 'type')
);

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_posts_scorecard_snapshot ON public.posts USING GIN (scorecard_snapshot);
CREATE INDEX IF NOT EXISTS idx_posts_round_id ON public.posts(round_id) WHERE round_id IS NOT NULL;

-- Function to build scorecard snapshot for a post from finished round data
-- This function extracts scorecard data from a finished round and formats it for display
-- ONLY generates snapshots for finished rounds (all holes completed)
CREATE OR REPLACE FUNCTION public.build_post_scorecard_snapshot(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
  v_players JSONB := '[]'::jsonb;
  v_player_data JSONB;
  v_scores JSONB;
  v_total INTEGER;
  v_thru INTEGER := 0;
  v_player_record RECORD;
  v_holes_array JSONB := '[]'::jsonb;
  v_holes_played INTEGER;
  v_score INTEGER;
  v_holes_with_scores INTEGER;
BEGIN
  -- Get holes_played for the round
  SELECT holes_played INTO v_holes_played
  FROM rounds
  WHERE id = p_round_id;
  
  IF v_holes_played IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if round is finished: verify at least one player has scores for all holes
  -- For multi-player rounds, check if any player has completed all holes
  SELECT COUNT(*) INTO v_holes_with_scores
  FROM (
    SELECT h.player_id, COUNT(DISTINCT h.hole_number) as holes_count
    FROM holes h
    INNER JOIN round_players rp ON h.player_id = rp.id
    WHERE h.round_id = p_round_id
      AND h.score > 0
      AND rp.round_id = p_round_id
    GROUP BY h.player_id
    HAVING COUNT(DISTINCT h.hole_number) >= v_holes_played
  ) completed_players;
  
  -- If no multi-player completion, check single-player holes
  IF v_holes_with_scores = 0 THEN
    SELECT COUNT(DISTINCT hole_number) INTO v_holes_with_scores
    FROM holes
    WHERE round_id = p_round_id
      AND player_id IS NULL
      AND score > 0;
    
    -- For single-player, must have all holes
    IF v_holes_with_scores < v_holes_played THEN
      v_holes_with_scores := 0;
    END IF;
  END IF;
  
  -- Only generate snapshot if round is finished (at least one player completed all holes)
  IF v_holes_with_scores = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Build holes array (1-18 or 1-9)
  FOR i IN 1..LEAST(v_holes_played, 18) LOOP
    v_holes_array := v_holes_array || to_jsonb(i);
  END LOOP;
  
  -- Build players array with their scores
  FOR v_player_record IN
    SELECT 
      rp.id as player_id,
      rp.user_id,
      rp.guest_name,
      rp.is_guest,
      COALESCE(p.display_name, p.username, rp.guest_name, 'Player') as display_name
    FROM round_players rp
    LEFT JOIN profiles p ON p.id = rp.user_id
    WHERE rp.round_id = p_round_id
    ORDER BY rp.created_at
  LOOP
    -- Build scores array for this player (1-18, nulls allowed)
    v_scores := '[]'::jsonb;
    v_total := 0;
    v_thru := 0;
    
    -- Initialize array with nulls for all holes
    FOR i IN 1..v_holes_played LOOP
      v_scores := v_scores || jsonb_build_array(NULL);
    END LOOP;
    
    -- Fill in actual scores
    FOR i IN 1..v_holes_played LOOP
      SELECT score INTO v_score
      FROM holes
      WHERE round_id = p_round_id
        AND hole_number = i
        AND player_id = v_player_record.player_id
      LIMIT 1;
      
      IF v_score IS NOT NULL AND v_score > 0 THEN
        v_scores := jsonb_set(v_scores, ARRAY[(i-1)::text], to_jsonb(v_score));
        v_total := v_total + v_score;
        v_thru := i;
      END IF;
    END LOOP;
    
    -- Build player object
    v_player_data := jsonb_build_object(
      'user_id', v_player_record.user_id,
      'player_id', v_player_record.player_id,
      'display_name', v_player_record.display_name,
      'guest_name', v_player_record.guest_name,
      'is_guest', COALESCE(v_player_record.is_guest, false),
      'scores', v_scores,
      'total', COALESCE(v_total, 0)
    );
    
    v_players := v_players || v_player_data;
  END LOOP;
  
  -- If no round_players exist, check for single-player round (holes without player_id)
  IF jsonb_array_length(v_players) = 0 THEN
    -- Check if there are any holes for this round
    SELECT COUNT(*) INTO v_total
    FROM holes
    WHERE round_id = p_round_id
    LIMIT 1;
    
    IF v_total > 0 THEN
      -- Single player round - get owner info
      SELECT 
        r.user_id,
        COALESCE(p.display_name, p.username, 'Player') as display_name
      INTO v_player_record
      FROM rounds r
      LEFT JOIN profiles p ON p.id = r.user_id
      WHERE r.id = p_round_id;
      
      -- Build scores array
      v_scores := '[]'::jsonb;
      v_total := 0;
      v_thru := 0;
      
      FOR i IN 1..v_holes_played LOOP
        v_scores := v_scores || jsonb_build_array(NULL);
      END LOOP;
      
      FOR i IN 1..v_holes_played LOOP
        SELECT score INTO v_score
        FROM holes
        WHERE round_id = p_round_id
          AND hole_number = i
          AND player_id IS NULL
        LIMIT 1;
        
        IF v_score IS NOT NULL AND v_score > 0 THEN
          v_scores := jsonb_set(v_scores, ARRAY[(i-1)::text], to_jsonb(v_score));
          v_total := v_total + v_score;
          v_thru := i;
        END IF;
      END LOOP;
      
      SELECT COALESCE(SUM(score), 0) INTO v_total
      FROM holes
      WHERE round_id = p_round_id
        AND player_id IS NULL
        AND score > 0;
      
      v_player_data := jsonb_build_object(
        'user_id', v_player_record.user_id,
        'player_id', NULL,
        'display_name', v_player_record.display_name,
        'guest_name', NULL,
        'is_guest', false,
        'scores', v_scores,
        'total', COALESCE(v_total, 0)
      );
      
      v_players := v_players || v_player_data;
    END IF;
  END IF;
  
  -- Build final snapshot - ensure it's a proper JSON object, not an array
  -- Wrap with metadata to ensure it's always an object
  v_snapshot := jsonb_build_object(
    'type', 'final',
    'created_at', now(),
    'holes', v_holes_array,
    'players', v_players,
    'thru', v_thru,
    'updated_at', now()
  );
  
  -- Validate: ensure snapshot is an object, not an array
  IF jsonb_typeof(v_snapshot) != 'object' THEN
    RAISE EXCEPTION 'Snapshot must be a JSON object, got: %', jsonb_typeof(v_snapshot);
  END IF;
  
  RETURN v_snapshot;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.build_post_scorecard_snapshot(uuid) TO authenticated;
