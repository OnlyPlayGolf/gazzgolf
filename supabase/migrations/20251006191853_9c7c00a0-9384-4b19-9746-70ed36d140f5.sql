CREATE POLICY "friendships_delete_involving_me"
ON public.friendships
FOR DELETE
USING (
  auth.uid() = requester OR
  auth.uid() = addressee OR
  auth.uid() = user_a OR
  auth.uid() = user_b
);