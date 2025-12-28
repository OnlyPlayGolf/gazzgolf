-- Create favorite courses table
CREATE TABLE public.favorite_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS
ALTER TABLE public.favorite_courses ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorite courses
CREATE POLICY "Users can view their own favorite courses"
ON public.favorite_courses
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own favorite courses
CREATE POLICY "Users can insert their own favorite courses"
ON public.favorite_courses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorite courses
CREATE POLICY "Users can delete their own favorite courses"
ON public.favorite_courses
FOR DELETE
USING (auth.uid() = user_id);