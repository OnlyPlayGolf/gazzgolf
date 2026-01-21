-- Backfill snapshots for rounds that don't have them yet
-- This will generate snapshots for the remaining rounds

DO $$
DECLARE
  round_rec RECORD;
  processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill for rounds without snapshots...';
  
  -- Only process rounds that have holes but no snapshot
  FOR round_rec IN 
    SELECT DISTINCT r.id as round_id
    FROM rounds r
    INNER JOIN holes h ON h.round_id = r.id
    WHERE r.scorecard_snapshot IS NULL
  LOOP
    BEGIN
      PERFORM public.rebuild_round_scorecard_snapshot(round_rec.round_id);
      processed_count := processed_count + 1;
      RAISE NOTICE 'Processed round %', round_rec.round_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to process round %: %', round_rec.round_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete! Processed % rounds.', processed_count;
END $$;

-- Verify results
SELECT 
  COUNT(*) as total_rounds,
  COUNT(scorecard_snapshot) as rounds_with_snapshots,
  COUNT(*) - COUNT(scorecard_snapshot) as rounds_without_snapshots
FROM rounds;
