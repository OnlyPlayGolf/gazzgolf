-- Create function to ensure a drill exists by title and return its id
CREATE OR REPLACE FUNCTION public.get_or_create_drill_by_title(p_title text)
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
    INSERT INTO public.drills (title) VALUES (p_title) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;