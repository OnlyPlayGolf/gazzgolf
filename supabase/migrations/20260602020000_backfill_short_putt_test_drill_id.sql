-- Backfill: Short Putt Test historically saved drill_results against a hardcoded
-- drills id ('16d74401-2d7f-4f5c-9b16-31c178bad027') instead of the row that
-- get_or_create_drill_by_title('Short Putt Test', ...) resolves to. The iOS app
-- now resolves the id via that RPC like every other drill, so re-point the
-- existing results onto the canonical row. This preserves all history and keeps
-- saves + the title-based history/leaderboard tabs consistent.
--
-- Safe + idempotent: if the hardcoded id already IS the canonical row this is a
-- no-op; after it runs no rows reference the old id, so re-running does nothing.

DO $$
DECLARE
  v_canonical_id uuid;
  v_legacy_id    uuid := '16d74401-2d7f-4f5c-9b16-31c178bad027'::uuid;
  v_moved        integer;
BEGIN
  v_canonical_id := public.get_or_create_drill_by_title('Short Putt Test', 'putting');

  IF v_canonical_id IS NOT NULL AND v_canonical_id <> v_legacy_id THEN
    UPDATE public.drill_results
       SET drill_id = v_canonical_id
     WHERE drill_id = v_legacy_id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE 'Short Putt Test backfill: moved % result rows from % to %',
      v_moved, v_legacy_id, v_canonical_id;
  ELSE
    RAISE NOTICE 'Short Putt Test backfill: canonical id already matches legacy id (%), nothing to do', v_legacy_id;
  END IF;
END $$;
