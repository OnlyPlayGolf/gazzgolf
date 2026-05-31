-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;

-- Create a new policy that allows all authenticated users to view profiles
-- This enables seeing commenter names regardless of friendship status
CREATE POLICY "profiles_read_all_authenticated" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);