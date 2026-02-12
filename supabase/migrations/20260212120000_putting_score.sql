-- Add normalized_score to drill_results (1-100 putting score)
ALTER TABLE public.drill_results ADD COLUMN IF NOT EXISTS normalized_score smallint;

-- Add shot_area to drills table (for filtering putting drills in aggregate queries)
ALTER TABLE public.drills ADD COLUMN IF NOT EXISTS shot_area text;

-- Seed built-in putting drills
UPDATE public.drills SET shot_area = 'putting'
WHERE title IN (
  'Short Putt Test',
  'PGA Tour 18',
  'Aggressive Putting 4-6m',
  'Up & Down Putts 6-10m',
  'Lag Putting Drill 8-20m'
);

-- Update get_or_create_drill_by_title to accept and set shot_area
CREATE OR REPLACE FUNCTION public.get_or_create_drill_by_title(
  p_title text,
  p_shot_area text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.drills WHERE title = p_title LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.drills (title, shot_area)
    VALUES (p_title, p_shot_area) RETURNING id INTO v_id;
  ELSIF p_shot_area IS NOT NULL THEN
    UPDATE public.drills SET shot_area = p_shot_area WHERE id = v_id AND shot_area IS NULL;
  END IF;
  RETURN v_id;
END;
$$;

-- RPC: get putting score average for a user
CREATE OR REPLACE FUNCTION public.putting_score_average(p_user_id uuid)
RETURNS TABLE(
  avg_score numeric,
  total_drills integer,
  last_10_avg numeric,
  best_score integer,
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
    ROUND(AVG(normalized_score), 1) as avg_score,
    COUNT(*)::integer as total_drills,
    ROUND(AVG(CASE WHEN rn <= 10 THEN normalized_score END), 1) as last_10_avg,
    MAX(normalized_score)::integer as best_score,
    ROUND(
      AVG(CASE WHEN rn <= 5 THEN normalized_score END) -
      AVG(CASE WHEN rn BETWEEN 6 AND 10 THEN normalized_score END),
      1
    ) as trend
  FROM putting_results;
$$;
