-- When a 21 Points drill result is inserted, create one row per other profile player
-- so their result shows in group history (RLS blocks client inserts for other users).
CREATE OR REPLACE FUNCTION public.create_21_points_participant_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_drill_title text;
  v_players jsonb;
  v_elem jsonb;
  v_od_id text;
  v_total_pts bigint;
  v_game_id text;
  v_count int;
BEGIN
  SELECT title INTO v_drill_title FROM public.drills WHERE id = NEW.drill_id;
  IF v_drill_title IS NULL OR v_drill_title != '21 Points' THEN
    RETURN NEW;
  END IF;

  v_players := (NEW.attempts_json::jsonb -> 'players');
  IF v_players IS NULL OR jsonb_typeof(v_players) != 'array' THEN
    RETURN NEW;
  END IF;

  -- Only create participant rows for the primary insert (from the client).
  -- Trigger-created rows would fire this again; skip to avoid duplicates/recursion.
  v_game_id := NEW.attempts_json::jsonb ->> 'gameId';
  IF v_game_id IS NOT NULL AND v_game_id != '' THEN
    SELECT count(*) INTO v_count FROM public.drill_results
    WHERE (attempts_json::jsonb ->> 'gameId') = v_game_id;
    IF v_count > 1 THEN
      RETURN NEW;
    END IF;
  END IF;

  FOR v_elem IN SELECT elem FROM jsonb_array_elements(v_players) AS elem
  LOOP
    v_od_id := v_elem ->> 'odId';
    IF v_od_id IS NULL OR v_od_id = '' OR v_od_id LIKE 'temp_%' OR v_od_id = (NEW.user_id)::text THEN
      CONTINUE;
    END IF;
    v_total_pts := COALESCE((v_elem ->> 'totalPoints')::bigint, 0);
    -- Check if row exists first (the unique index will catch any race conditions)
    IF NOT EXISTS (
      SELECT 1 FROM public.drill_results
      WHERE user_id = v_od_id::uuid
        AND drill_id = NEW.drill_id
        AND (attempts_json::jsonb ->> 'gameId') = v_game_id
    ) THEN
      INSERT INTO public.drill_results (user_id, drill_id, total_points, attempts_json)
      VALUES (v_od_id::uuid, NEW.drill_id, v_total_pts, NEW.attempts_json);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_21_points_participant_rows_trigger ON public.drill_results;
CREATE TRIGGER create_21_points_participant_rows_trigger
  AFTER INSERT ON public.drill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.create_21_points_participant_rows();
