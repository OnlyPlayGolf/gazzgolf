-- Fix: Drop the old single-parameter overload of get_or_create_drill_by_title
-- that conflicts with the newer 2-parameter version.
-- PostgREST cannot resolve the ambiguity when only p_title is passed,
-- causing PGRST203 errors for drills that don't pass p_shot_area.

DROP FUNCTION IF EXISTS public.get_or_create_drill_by_title(text);

-- Recreate the canonical version with p_shot_area DEFAULT NULL
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
    INSERT INTO public.drills (title, shot_area, visibility)
    VALUES (p_title, p_shot_area, 'coach_only') RETURNING id INTO v_id;
  ELSIF p_shot_area IS NOT NULL THEN
    UPDATE public.drills SET shot_area = p_shot_area WHERE id = v_id AND shot_area IS NULL;
  END IF;
  RETURN v_id;
END;
$$;
