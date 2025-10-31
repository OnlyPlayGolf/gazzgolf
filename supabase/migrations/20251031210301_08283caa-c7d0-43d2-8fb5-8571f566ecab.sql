-- Allow users to view their friends' rounds
CREATE POLICY "Users can view friends' rounds"
ON public.rounds
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = rounds.user_id)
       OR (fp.b = auth.uid() AND fp.a = rounds.user_id)
  )
);