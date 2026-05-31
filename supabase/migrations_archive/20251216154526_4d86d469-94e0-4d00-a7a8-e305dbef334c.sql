-- Add round_name column to rounds table
ALTER TABLE public.rounds ADD COLUMN round_name text;

-- Set existing rounds' round_name to course_name as fallback
UPDATE public.rounds SET round_name = course_name WHERE round_name IS NULL;