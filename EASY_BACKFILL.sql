-- EASY BACKFILL - Just copy and paste this entire block
-- No need to replace anything, it will process all rounds automatically

DO $$
DECLARE
  round_id_val UUID;
  processed INTEGER := 0;
  failed INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill for all rounds with holes...';
  
  -- Process each round that has holes
  FOR round_id_val IN 
    SELECT DISTINCT round_id 
    FROM holes
    ORDER BY round_id
  LOOP
    BEGIN
      -- Rebuild snapshot for this round
      PERFORM public.rebuild_round_scorecard_snapshot(round_id_val);
      processed := processed + 1;
      
      -- Show progress
      IF processed % 2 = 0 THEN
        RAISE NOTICE 'Processed % rounds so far...', processed;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        failed := failed + 1;
        RAISE WARNING 'Failed to process round %: %', round_id_val, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '=== BACKFILL COMPLETE ===';
  RAISE NOTICE 'Successfully processed: % rounds', processed;
  IF failed > 0 THEN
    RAISE NOTICE 'Failed: % rounds', failed;
  END IF;
END $$;

-- After running above, verify with this:
SELECT 
  COUNT(*) as total_rounds,
  COUNT(scorecard_snapshot) as rounds_with_snapshots,
  COUNT(*) - COUNT(scorecard_snapshot) as rounds_without_snapshots
FROM rounds;
