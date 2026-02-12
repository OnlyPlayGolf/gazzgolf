-- Convert normalized_score from 1-100 putting score to estimated putting HCP × 10
-- (e.g., 12.3 HCP stored as 123)

-- Clear stale 1-100 normalized scores (feature was just added, minimal data)
UPDATE public.drill_results SET normalized_score = NULL
WHERE normalized_score IS NOT NULL
  AND drill_id IN (SELECT id FROM public.drills WHERE shot_area = 'putting');

-- Drop old function (return type changed: best_score from integer to numeric)
DROP FUNCTION IF EXISTS public.putting_score_average(uuid);

-- Recreate putting_score_average RPC for HCP-based scoring
-- Key changes: MIN instead of MAX for best (lower HCP = better),
-- divide by 10 to convert stored values to HCP
CREATE OR REPLACE FUNCTION public.putting_score_average(p_user_id uuid)
RETURNS TABLE(
  avg_score numeric,
  total_drills integer,
  last_10_avg numeric,
  best_score numeric,
  trend numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH putting_results AS (
    SELECT dr.normalized_score, dr.created_at,
           ROW_NUMBER() OVER (ORDER BY dr.created_at DESC) as rn
    FROM public.drill_results dr
    JOIN public.drills d ON d.id = dr.drill_id
    WHERE dr.user_id = p_user_id
      AND dr.normalized_score IS NOT NULL
      AND d.shot_area = 'putting'
  )
  SELECT
    ROUND(AVG(normalized_score) / 10.0, 1) as avg_score,
    COUNT(*)::integer as total_drills,
    ROUND(AVG(CASE WHEN rn <= 10 THEN normalized_score END) / 10.0, 1) as last_10_avg,
    ROUND(MIN(normalized_score) / 10.0, 1) as best_score,
    ROUND(
      (AVG(CASE WHEN rn <= 5 THEN normalized_score END) -
       AVG(CASE WHEN rn BETWEEN 6 AND 10 THEN normalized_score END)) / 10.0,
      1
    ) as trend
  FROM putting_results;
$$;
