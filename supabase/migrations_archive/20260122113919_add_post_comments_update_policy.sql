-- Allow users to update their own comments
CREATE POLICY "post_comments_update_policy" ON public.post_comments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
