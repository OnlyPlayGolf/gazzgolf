-- Backfill script: Generate snapshots for all existing rounds
-- Run this AFTER the main migration (20260120000000_add_scorecard_snapshot.sql)
-- This will rebuild snapshots for all existing rounds that have holes

DO $$
DECLARE
  r RECORD;
  processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of scorecard snapshots...';
  
  FOR r IN SELECT DISTINCT round_id FROM holes LOOP
    BEGIN
      PERFORM public.rebuild_round_scorecard_snapshot(r.round_id);
      processed_count := processed_count + 1;
      
      -- Log progress every 100 rounds
      IF processed_count % 100 = 0 THEN
        RAISE NOTICE 'Processed % rounds...', processed_count;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to process round %: %', r.round_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete! Processed % rounds.', processed_count;
END $$;
