-- RPC to create drill_results rows for all other profile players in a 21 Points game.
-- Called by the client after saving the current user's row so each participant's score
-- is stored to their account and shows in Groups History (client cannot insert for other users due to RLS).
CREATE OR REPLACE FUNCTION public.create_21_points_participant_rows_rpc(
  p_drill_id uuid,
  p_attempts_json jsonb,
  p_exclude_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_players jsonb;
  v_elem jsonb;
  v_od_id text;
  v_total_pts bigint;
BEGIN
  v_players := p_attempts_json -> 'players';
  IF v_players IS NULL OR jsonb_typeof(v_players) != 'array' THEN
    RETURN;
  END IF;

  FOR v_elem IN SELECT elem FROM jsonb_array_elements(v_players) AS elem
  LOOP
    v_od_id := v_elem ->> 'odId';
    IF v_od_id IS NULL OR v_od_id = '' OR v_od_id LIKE 'temp_%' OR v_od_id = (p_exclude_user_id)::text THEN
      CONTINUE;
    END IF;
    v_total_pts := COALESCE((v_elem ->> 'totalPoints')::bigint, 0);
    -- Check if row exists first (ON CONFLICT with partial unique index is complex)
    -- The unique index will prevent duplicates if both trigger and RPC run simultaneously
    IF NOT EXISTS (
      SELECT 1 FROM public.drill_results
      WHERE user_id = v_od_id::uuid
        AND drill_id = p_drill_id
        AND (attempts_json::jsonb ->> 'gameId') = (p_attempts_json ->> 'gameId')
    ) THEN
      INSERT INTO public.drill_results (user_id, drill_id, total_points, attempts_json)
      VALUES (v_od_id::uuid, p_drill_id, v_total_pts, p_attempts_json);
    END IF;
  END LOOP;
END;
$$;
