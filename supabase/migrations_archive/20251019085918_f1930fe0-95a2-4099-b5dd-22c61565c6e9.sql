-- Step 1: Drop the view that depends on approach_result
DROP VIEW IF EXISTS public.round_summaries CASCADE;

-- Step 2: Add a new column for multiple approach results
ALTER TABLE public.holes ADD COLUMN approach_results text[] DEFAULT '{}';

-- Step 3: Migrate existing single approach_result data to the array
UPDATE public.holes
SET approach_results = ARRAY[approach_result::text]
WHERE approach_result IS NOT NULL;

-- Step 4: Drop the old single approach_result column
ALTER TABLE public.holes DROP COLUMN approach_result;

-- Step 5: Recreate the round_summaries view with updated logic
CREATE VIEW public.round_summaries AS
SELECT 
  r.id AS round_id,
  r.user_id,
  r.course_name,
  r.date_played,
  r.holes_played,
  r.tee_set,
  SUM(h.score) AS total_score,
  SUM(h.par) AS total_par,
  SUM(h.score) - SUM(h.par) AS score_vs_par,
  SUM(h.putts) AS total_putts,
  COUNT(*) FILTER (WHERE h.putts > 2) AS three_putts,
  SUM(h.penalties) AS total_penalties,
  COUNT(*) FILTER (WHERE h.tee_result = 'FIR') AS fairways_hit,
  COUNT(*) FILTER (WHERE h.par >= 4) AS par4_and_5_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE h.par >= 4) > 0 
    THEN (COUNT(*) FILTER (WHERE h.tee_result = 'FIR')::float / COUNT(*) FILTER (WHERE h.par >= 4)) * 100
    ELSE NULL
  END AS fir_percentage,
  COUNT(*) FILTER (WHERE 'GIR' = ANY(h.approach_results)) AS greens_hit,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE 'GIR' = ANY(h.approach_results))::float / COUNT(*)) * 100
    ELSE NULL
  END AS gir_percentage,
  COUNT(*) FILTER (WHERE h.sand_save = true) AS sand_saves,
  COUNT(*) FILTER (WHERE h.up_and_down = true) AS up_and_downs,
  COUNT(*) FILTER (WHERE NOT ('GIR' = ANY(h.approach_results))) AS missed_greens,
  CASE 
    WHEN COUNT(*) FILTER (WHERE NOT ('GIR' = ANY(h.approach_results))) > 0 
    THEN (COUNT(*) FILTER (WHERE h.up_and_down = true)::float / COUNT(*) FILTER (WHERE NOT ('GIR' = ANY(h.approach_results)))) * 100
    ELSE NULL
  END AS updown_percentage
FROM public.rounds r
LEFT JOIN public.holes h ON h.round_id = r.id
GROUP BY r.id, r.user_id, r.course_name, r.date_played, r.holes_played, r.tee_set;