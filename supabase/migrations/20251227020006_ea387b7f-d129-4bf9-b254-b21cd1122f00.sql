-- Allow authenticated users to search for other profiles (needed for friend search)
CREATE POLICY "Authenticated users can search profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);