-- Allow authenticated users to insert courses
CREATE POLICY "Authenticated users can insert courses"
ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to insert course holes
CREATE POLICY "Authenticated users can insert course holes"
ON public.course_holes
FOR INSERT
TO authenticated
WITH CHECK (true);