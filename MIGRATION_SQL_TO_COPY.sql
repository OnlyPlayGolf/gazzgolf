-- Add scorecard_snapshot JSONB column to rounds table
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS scorecard_snapshot JSONB DEFAULT NULL;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_rounds_scorecard_snapshot ON public.rounds USING GIN (scorecard_snapshot);

-- Function to rebuild scorecard snapshot for a round
CREATE OR REPLACE FUNCTION public.rebuild_round_scorecard_snapshot(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_holes_played INTEGER;
  v_snapshot JSONB;
  v_players JSONB := '[]'::jsonb;
  v_player_data JSONB;
  v_scores JSONB;
  v_total INTEGER;
  v_thru INTEGER := 0;
  v_player_record RECORD;
  v_holes_array JSONB := '[]'::jsonb;
BEGIN
  -- Get holes_played for the round
  SELECT holes_played INTO v_holes_played
  FROM rounds
  WHERE id = p_round_id;
  
  IF v_holes_played IS NULL THEN
    RETURN;
  END IF;
  
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
      SELECT score INTO v_total
      FROM holes
      WHERE round_id = p_round_id
        AND hole_number = i
        AND player_id = v_player_record.player_id
      LIMIT 1;
      
      IF v_total IS NOT NULL AND v_total > 0 THEN
        v_scores := jsonb_set(v_scores, ARRAY[i-1]::text[], to_jsonb(v_total));
        v_thru := i;
      END IF;
    END LOOP;
    
    -- Calculate total score
    SELECT COALESCE(SUM(score), 0) INTO v_total
    FROM holes
    WHERE round_id = p_round_id
      AND player_id = v_player_record.player_id
      AND score > 0;
    
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
        SELECT score INTO v_total
        FROM holes
        WHERE round_id = p_round_id
          AND hole_number = i
          AND player_id IS NULL
        LIMIT 1;
        
        IF v_total IS NOT NULL AND v_total > 0 THEN
          v_scores := jsonb_set(v_scores, ARRAY[i-1]::text[], to_jsonb(v_total));
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
      
      v_players := jsonb_build_array(v_player_data);
    END IF;
  END IF;
  
  -- Calculate thru (highest hole number with a score across all players)
  SELECT COALESCE(MAX(hole_number), 0) INTO v_thru
  FROM holes
  WHERE round_id = p_round_id
    AND score > 0;
  
  -- Build holes array [1..18]
  v_holes_array := '[]'::jsonb;
  FOR i IN 1..v_holes_played LOOP
    v_holes_array := v_holes_array || to_jsonb(i);
  END LOOP;
  
  -- Build final snapshot
  v_snapshot := jsonb_build_object(
    'holes', v_holes_array,
    'players', v_players,
    'thru', v_thru,
    'updated_at', NOW()
  );
  
  -- Update the round with the snapshot
  UPDATE rounds
  SET scorecard_snapshot = v_snapshot
  WHERE id = p_round_id;
END;
$$;

-- Update round_summaries view to include scorecard_snapshot
CREATE OR REPLACE VIEW public.round_summaries
WITH (security_invoker = true)
AS
SELECT r.id AS round_id,
    r.user_id,
    r.course_name,
    r.date_played,
    r.holes_played,
    r.tee_set,
    r.scorecard_snapshot,
    sum(h.score) AS total_score,
    sum(h.par) AS total_par,
    sum(h.score) - sum(h.par) AS score_vs_par,
    sum(h.putts) AS total_putts,
    count(*) FILTER (WHERE h.putts > 2) AS three_putts,
    sum(h.penalties) AS total_penalties,
    count(*) FILTER (WHERE h.tee_result = 'FIR'::tee_result) AS fairways_hit,
    count(*) FILTER (WHERE h.par >= 4) AS par4_and_5_count,
        CASE
            WHEN count(*) FILTER (WHERE h.par >= 4) > 0 THEN count(*) FILTER (WHERE h.tee_result = 'FIR'::tee_result)::double precision / count(*) FILTER (WHERE h.par >= 4)::double precision * 100::double precision
            ELSE NULL::double precision
        END AS fir_percentage,
    count(*) FILTER (WHERE 'GIR'::text = ANY (h.approach_results)) AS greens_hit,
        CASE
            WHEN count(*) > 0 THEN count(*) FILTER (WHERE 'GIR'::text = ANY (h.approach_results))::double precision / count(*)::double precision * 100::double precision
            ELSE NULL::double precision
        END AS gir_percentage,
    count(*) FILTER (WHERE h.sand_save = true) AS sand_saves,
    count(*) FILTER (WHERE h.up_and_down = true) AS up_and_downs,
    count(*) FILTER (WHERE NOT ('GIR'::text = ANY (h.approach_results))) AS missed_greens,
        CASE
            WHEN count(*) FILTER (WHERE NOT ('GIR'::text = ANY (h.approach_results))) > 0 THEN count(*) FILTER (WHERE h.up_and_down = true)::double precision / count(*) FILTER (WHERE NOT ('GIR'::text = ANY (h.approach_results)))::double precision * 100::double precision
            ELSE NULL::double precision
        END AS updown_percentage
   FROM rounds r
     LEFT JOIN holes h ON h.round_id = r.id
  GROUP BY r.id, r.user_id, r.course_name, r.date_played, r.holes_played, r.tee_set, r.scorecard_snapshot;

-- Trigger function to rebuild snapshot when holes change
CREATE OR REPLACE FUNCTION public.trigger_rebuild_scorecard_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_round_id uuid;
BEGIN
  -- Get round_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_round_id := OLD.round_id;
  ELSE
    v_round_id := NEW.round_id;
  END IF;
  
  -- Rebuild snapshot for this round
  PERFORM public.rebuild_round_scorecard_snapshot(v_round_id);
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers on holes table
DROP TRIGGER IF EXISTS trigger_holes_rebuild_snapshot_insert ON public.holes;
CREATE TRIGGER trigger_holes_rebuild_snapshot_insert
  AFTER INSERT ON public.holes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_rebuild_scorecard_snapshot();

DROP TRIGGER IF EXISTS trigger_holes_rebuild_snapshot_update ON public.holes;
CREATE TRIGGER trigger_holes_rebuild_snapshot_update
  AFTER UPDATE ON public.holes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_rebuild_scorecard_snapshot();

DROP TRIGGER IF EXISTS trigger_holes_rebuild_snapshot_delete ON public.holes;
CREATE TRIGGER trigger_holes_rebuild_snapshot_delete
  AFTER DELETE ON public.holes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_rebuild_scorecard_snapshot();
