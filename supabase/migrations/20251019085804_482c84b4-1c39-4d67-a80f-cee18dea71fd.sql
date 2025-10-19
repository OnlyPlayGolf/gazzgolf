-- Step 1: Drop the view that depends on tee_result
DROP VIEW IF EXISTS public.round_summaries CASCADE;

-- Step 2: Convert column to text temporarily
ALTER TABLE public.holes ALTER COLUMN tee_result TYPE text;

-- Step 3: Drop the old enum type
DROP TYPE IF EXISTS public.tee_result CASCADE;

-- Step 4: Create new enum with updated values (removed Penalty, added Water and OOB)
CREATE TYPE public.tee_result AS ENUM (
  'FIR',
  'MissL',
  'MissR',
  'Water',
  'OOB'
);

-- Step 5: Update existing data - map Penalty to Water as default
UPDATE public.holes
SET tee_result = CASE 
  WHEN tee_result = 'Penalty' THEN 'Water'
  WHEN tee_result IN ('FIR', 'MissL', 'MissR') THEN tee_result
  ELSE NULL
END
WHERE tee_result IS NOT NULL;

-- Step 6: Convert column back to enum type
ALTER TABLE public.holes 
ALTER COLUMN tee_result TYPE public.tee_result 
USING tee_result::public.tee_result;

-- Step 7: Recreate the round_summaries view
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
  COUNT(*) FILTER (WHERE h.approach_result = 'GIR') AS greens_hit,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(*) FILTER (WHERE h.approach_result = 'GIR')::float / COUNT(*)) * 100
    ELSE NULL
  END AS gir_percentage,
  COUNT(*) FILTER (WHERE h.sand_save = true) AS sand_saves,
  COUNT(*) FILTER (WHERE h.up_and_down = true) AS up_and_downs,
  COUNT(*) FILTER (WHERE h.approach_result != 'GIR') AS missed_greens,
  CASE 
    WHEN COUNT(*) FILTER (WHERE h.approach_result != 'GIR') > 0 
    THEN (COUNT(*) FILTER (WHERE h.up_and_down = true)::float / COUNT(*) FILTER (WHERE h.approach_result != 'GIR')) * 100
    ELSE NULL
  END AS updown_percentage
FROM public.rounds r
LEFT JOIN public.holes h ON h.round_id = r.id
GROUP BY r.id, r.user_id, r.course_name, r.date_played, r.holes_played, r.tee_set;