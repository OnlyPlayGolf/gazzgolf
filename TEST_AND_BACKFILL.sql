-- Step 1: Test the function works on one round
-- First, let's test if the function exists and works

-- Get a round_id that has holes but no snapshot
SELECT r.id, r.course_name, COUNT(h.id) as hole_count
FROM rounds r
LEFT JOIN holes h ON h.round_id = r.id
WHERE r.scorecard_snapshot IS NULL
GROUP BY r.id, r.course_name
HAVING COUNT(h.id) > 0
LIMIT 1;

-- Step 2: Test the function manually (replace 'YOUR-ROUND-ID-HERE' with actual ID from step 1)
-- SELECT public.rebuild_round_scorecard_snapshot('YOUR-ROUND-ID-HERE'::uuid);

-- Step 3: Backfill ALL rounds with holes (simpler approach)
DO $$
DECLARE
  round_id_val UUID;
  processed INTEGER := 0;
BEGIN
  -- Process each round that has holes
  FOR round_id_val IN 
    SELECT DISTINCT round_id 
    FROM holes
  LOOP
    BEGIN
      -- Rebuild snapshot (will overwrite if exists, create if doesn't)
      PERFORM public.rebuild_round_scorecard_snapshot(round_id_val);
      processed := processed + 1;
      
      -- Log every 5 rounds
      IF processed % 5 = 0 THEN
        RAISE NOTICE 'Processed % rounds...', processed;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error processing round %: %', round_id_val, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Complete! Processed % rounds total.', processed;
END $$;

-- Step 4: Verify results
SELECT 
  COUNT(*) as total_rounds,
  COUNT(scorecard_snapshot) as with_snapshots,
  COUNT(*) - COUNT(scorecard_snapshot) as without_snapshots
FROM rounds;
