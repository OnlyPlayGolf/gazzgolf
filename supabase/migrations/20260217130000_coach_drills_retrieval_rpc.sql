-- ============================================================
-- Phase 2: Coach AI RAG-lite — retrieval RPC
-- ============================================================

-- Retrieval function: returns top-scoring drills matching focus_area + difficulty
-- Uses quality scoring: (upvotes - downvotes) + completion_count * 0.2 + times_used * 0.05
-- Adds freshness decay: drills older than 30 days get a small penalty
-- Filters by focus_area (exact match preferred, mixed as fallback)
-- Filters by difficulty (exact preferred, neighbors as fallback)
-- Excludes specific drill IDs (recently generated for this user)

CREATE OR REPLACE FUNCTION public.get_recommended_coach_drills(
  p_focus_area text,
  p_difficulty text DEFAULT NULL,
  p_exclude_ids uuid[] DEFAULT '{}',
  p_limit int DEFAULT 7
)
RETURNS TABLE (
  id uuid,
  title text,
  focus_area text,
  difficulty text,
  goal_tags text[],
  drill_type text,
  shot_area text,
  goal text,
  setup_steps jsonb,
  rules jsonb,
  outcomes jsonb,
  time_minutes int,
  lower_is_better boolean,
  quality_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scored AS (
    SELECT
      cd.id,
      cd.title,
      cd.focus_area,
      cd.difficulty,
      cd.goal_tags,
      (cd.payload->>'drill_type')::text AS drill_type,
      (cd.payload->>'shot_area')::text AS shot_area,
      (cd.payload->>'goal')::text AS goal,
      cd.payload->'setup_steps' AS setup_steps,
      cd.payload->'rules' AS rules,
      cd.payload->'outcomes' AS outcomes,
      (cd.payload->>'time_minutes')::int AS time_minutes,
      (cd.payload->>'lower_is_better')::boolean AS lower_is_better,
      -- Base quality score
      (cd.upvotes - cd.downvotes)
        + (cd.completion_count * 0.2)
        + (cd.times_used * 0.05)
      -- Focus area bonus: +3 for exact match, +1 for mixed, 0 for mismatch
      + CASE
          WHEN cd.focus_area = p_focus_area THEN 3
          WHEN cd.focus_area = 'mixed' THEN 1
          ELSE 0
        END
      -- Difficulty bonus: +2 exact, +1 adjacent, 0 mismatch
      + CASE
          WHEN p_difficulty IS NULL THEN 0
          WHEN cd.difficulty = p_difficulty THEN 2
          WHEN cd.difficulty IS NULL THEN 0
          -- adjacent difficulty levels
          WHEN p_difficulty = 'beginner' AND cd.difficulty = 'intermediate' THEN 1
          WHEN p_difficulty = 'intermediate' AND cd.difficulty IN ('beginner', 'advanced') THEN 1
          WHEN p_difficulty = 'advanced' AND cd.difficulty = 'intermediate' THEN 1
          ELSE 0
        END
      -- Freshness: small penalty for old drills (max -2 for drills >60 days old)
      - LEAST(
          EXTRACT(EPOCH FROM (now() - cd.created_at)) / (30 * 86400),
          2
        )
      AS quality_score
    FROM public.coach_drills cd
    WHERE
      -- Must have focus_area populated
      cd.focus_area IS NOT NULL
      -- Exclude specific IDs
      AND (p_exclude_ids IS NULL OR cd.id != ALL(p_exclude_ids))
      -- Must not be downvoted into oblivion
      AND (cd.upvotes - cd.downvotes) >= -2
      -- Focus area: exact match OR mixed OR same broad category
      AND (
        cd.focus_area = p_focus_area
        OR cd.focus_area = 'mixed'
        OR p_focus_area = 'mixed'
      )
  )
  SELECT
    s.id, s.title, s.focus_area, s.difficulty, s.goal_tags,
    s.drill_type, s.shot_area, s.goal, s.setup_steps, s.rules,
    s.outcomes, s.time_minutes, s.lower_is_better, s.quality_score
  FROM scored s
  ORDER BY s.quality_score DESC
  LIMIT p_limit;
$$;
