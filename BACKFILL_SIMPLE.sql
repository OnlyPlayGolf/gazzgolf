-- SIMPLE BACKFILL - Copy and paste this entire block into Supabase SQL Editor
-- This will generate snapshots for all rounds that have holes

DO $$
DECLARE
  round_rec RECORD;
  processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill...';
  
  FOR round_rec IN 
    SELECT DISTINCT r.id as round_id
    FROM rounds r
    INNER JOIN holes h ON h.round_id = r.id
    WHERE r.scorecard_snapshot IS NULL
  LOOP
    BEGIN
      PERFORM public.rebuild_round_scorecard_snapshot(round_rec.round_id);
      processed_count := processed_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed round %: %', round_rec.round_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Done! Processed % rounds.', processed_count;
END $$;
