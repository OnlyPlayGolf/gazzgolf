-- WORKING BACKFILL - Run this in Supabase SQL Editor
-- This processes all rounds that have holes

DO $$
DECLARE
  round_id_val UUID;
  processed INTEGER := 0;
  total_rounds INTEGER;
BEGIN
  -- Count how many we'll process
  SELECT COUNT(DISTINCT round_id) INTO total_rounds FROM holes;
  RAISE NOTICE 'Found % rounds with holes to process', total_rounds;
  
  -- Process each round
  FOR round_id_val IN 
    SELECT DISTINCT round_id 
    FROM holes
    ORDER BY round_id
  LOOP
    BEGIN
      PERFORM public.rebuild_round_scorecard_snapshot(round_id_val);
      processed := processed + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed round %: %', round_id_val, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete! Successfully processed % of % rounds', processed, total_rounds;
END $$;
