-- Add visibility column to drills table
-- 'featured' = shown on Practice page (default for existing drills)
-- 'coach_only' = only surfaced by Coach AI, not shown in browse lists
ALTER TABLE public.drills ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'featured';

-- Update get_or_create_drill_by_title so auto-created drills default to 'coach_only'
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
