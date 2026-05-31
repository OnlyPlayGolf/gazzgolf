-- Drop the existing policy
DROP POLICY IF EXISTS "profiles_read_authenticated" ON profiles;

-- Create updated policy that also allows viewing profiles of pending friend request users
CREATE POLICY "profiles_read_authenticated" ON profiles
FOR SELECT
USING (
  -- Can view own profile
  auth.uid() = id
  OR
  -- Can view friends' profiles
  EXISTS (
    SELECT 1 FROM friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = profiles.id) 
       OR (fp.b = auth.uid() AND fp.a = profiles.id)
  )
  OR
  -- Can view group members' profiles
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm2.group_id = gm1.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
  )
  OR
  -- Can view profiles of users involved in pending friend requests with me
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'pending'
      AND (
        (f.requester = auth.uid() AND f.addressee = profiles.id)
        OR (f.addressee = auth.uid() AND f.requester = profiles.id)
      )
  )
);