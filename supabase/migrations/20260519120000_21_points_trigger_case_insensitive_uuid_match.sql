-- =====================================================================
-- Fix 21 Points save failure caused by uppercase-UUID drift between
-- client JSON and Postgres uuid columns.
--
-- Symptom: clients see `duplicate key value violates unique constraint
-- "idx_drill_results_user_drill_game"` when saving a 21 Points result,
-- and the entire drill_results INSERT rolls back. Reported logs:
--
--   🔵 21Points: Drill ID: d7a10a80-...
--   ❌ 21Points: Failed to save drill result: 23505 ...
--
-- Root cause: `UUID.uuidString` on iOS (Swift) returns the UUID in
-- uppercase. The save payload encodes each player's `odId` as that
-- uppercase string. Postgres normalises `uuid` columns to lowercase on
-- storage, so `NEW.user_id::text` is lowercase.
--
-- Both the trigger function (`create_21_points_participant_rows`) and
-- its companion RPC (`create_21_points_participant_rows_rpc`) compare
-- the JSON `odId` against `NEW.user_id::text` with a plain `=`:
--
--     IF v_od_id = (NEW.user_id)::text THEN CONTINUE;
--
-- For an iOS-saved row this comparison is FALSE — uppercase ≠
-- lowercase — so the trigger does NOT skip the saving user. It tries
-- to re-INSERT a participant row for them, the row collides with the
-- primary INSERT the client just performed, the unique partial index
-- on `(user_id, drill_id, attempts_json->>'gameId')` fires, and the
-- parent transaction rolls back.
--
-- Fix: compare case-insensitively in both the trigger and the RPC.
-- Also lowercase `v_od_id` before casting to uuid so any lookup query
-- inside the trigger (the EXISTS check) is consistent with what
-- Postgres stores.
--
-- This is a SECURITY DEFINER function migration; the search_path,
-- LANGUAGE, and trigger wiring all stay identical to the prior
-- definition. Only the comparison + lookup casing change.
-- =====================================================================

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
  v_od_id_lower text;
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
    v_od_id_lower := LOWER(COALESCE(v_od_id, ''));

    -- Skip empty, temporary (guest), and self entries. The self check
    -- is case-insensitive because iOS sends uppercase UUIDs in JSON
    -- but Postgres normalises uuid columns to lowercase on storage —
    -- a plain `=` would falsely miss the current user and double-
    -- insert them, hitting the unique partial index.
    IF v_od_id IS NULL
       OR v_od_id = ''
       OR v_od_id LIKE 'temp_%'
       OR v_od_id_lower = LOWER((NEW.user_id)::text)
    THEN
      CONTINUE;
    END IF;

    v_total_pts := COALESCE((v_elem ->> 'totalPoints')::bigint, 0);
    -- Look up using the lowercased form to keep the EXISTS check
    -- consistent with how Postgres stores the uuid column. A
    -- mixed-case `v_od_id::uuid` cast would still match storage (the
    -- uuid type accepts both cases on input), but normalising at the
    -- comparison boundary removes ambiguity for the index-driven
    -- lookup.
    IF NOT EXISTS (
      SELECT 1 FROM public.drill_results
      WHERE user_id = v_od_id_lower::uuid
        AND drill_id = NEW.drill_id
        AND (attempts_json::jsonb ->> 'gameId') = v_game_id
    ) THEN
      INSERT INTO public.drill_results (user_id, drill_id, total_points, attempts_json)
      VALUES (v_od_id_lower::uuid, NEW.drill_id, v_total_pts, NEW.attempts_json);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_21_points_participant_rows() IS
  '21 Points AFTER INSERT trigger function — creates one drill_results row per other profile player in the game so their score shows in Groups History (RLS blocks client inserts for other users). Self-skip and EXISTS lookup are case-insensitive on the player odId to handle iOS clients that send uppercase UUIDs in the JSON attempts_json.players[].odId field.';

-- Re-wire the trigger so the new function body is what runs. (The
-- trigger name + timing stays identical, so this is a no-op in
-- behavior — but it makes the migration self-contained and explicit.)
DROP TRIGGER IF EXISTS create_21_points_participant_rows_trigger ON public.drill_results;
CREATE TRIGGER create_21_points_participant_rows_trigger
  AFTER INSERT ON public.drill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.create_21_points_participant_rows();

-- ---------------------------------------------------------------------
-- Sibling RPC — same fix. The RPC is the original participant-creation
-- path; the trigger superseded it but the RPC stayed in place as a
-- safety net (and is referenced in the unique-index migration's
-- comment). Both must agree on case-insensitive comparison or the RPC
-- could re-introduce the same bug if a future client re-adopts it.
-- ---------------------------------------------------------------------

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
  v_od_id_lower text;
  v_total_pts bigint;
BEGIN
  v_players := p_attempts_json -> 'players';
  IF v_players IS NULL OR jsonb_typeof(v_players) != 'array' THEN
    RETURN;
  END IF;

  FOR v_elem IN SELECT elem FROM jsonb_array_elements(v_players) AS elem
  LOOP
    v_od_id := v_elem ->> 'odId';
    v_od_id_lower := LOWER(COALESCE(v_od_id, ''));

    -- Same case-insensitive self-skip as the trigger.
    IF v_od_id IS NULL
       OR v_od_id = ''
       OR v_od_id LIKE 'temp_%'
       OR v_od_id_lower = LOWER((p_exclude_user_id)::text)
    THEN
      CONTINUE;
    END IF;

    v_total_pts := COALESCE((v_elem ->> 'totalPoints')::bigint, 0);
    IF NOT EXISTS (
      SELECT 1 FROM public.drill_results
      WHERE user_id = v_od_id_lower::uuid
        AND drill_id = p_drill_id
        AND (attempts_json::jsonb ->> 'gameId') = (p_attempts_json ->> 'gameId')
    ) THEN
      INSERT INTO public.drill_results (user_id, drill_id, total_points, attempts_json)
      VALUES (v_od_id_lower::uuid, p_drill_id, v_total_pts, p_attempts_json);
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_21_points_participant_rows_rpc(uuid, jsonb, uuid) IS
  'Companion RPC to create_21_points_participant_rows trigger. Called by clients that prefer explicit participant-row creation (legacy save path). Self-skip and EXISTS lookup are case-insensitive on the odId to match iOS clients that send uppercase UUIDs.';
