-- Fix PUBLIC_DATA_EXPOSURE: User profiles exposed to unauthenticated internet
-- Drop the public access policy that allows anyone to read all profiles
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;

-- Create authenticated-only policy
-- Users can see their own profile, profiles of friends, or profiles of group members
CREATE POLICY "profiles_read_authenticated"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own profile
  auth.uid() = id
  OR
  -- Users can see profiles of their friends
  EXISTS (
    SELECT 1 FROM friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = profiles.id)
       OR (fp.b = auth.uid() AND fp.a = profiles.id)
  )
  OR
  -- Users can see profiles of people in their groups
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm2.group_id = gm1.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = profiles.id
  )
);