-- Add course_id column to umbriago_games
ALTER TABLE public.umbriago_games 
ADD COLUMN course_id uuid REFERENCES public.courses(id);