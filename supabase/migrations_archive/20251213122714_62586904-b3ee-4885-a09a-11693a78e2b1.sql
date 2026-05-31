-- Add RLS policy for friends to view holes in friends' rounds
CREATE POLICY "Friends can view holes in friends rounds"
ON public.holes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id
    AND (
      r.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friends_pairs fp
        WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
        OR (fp.b = auth.uid() AND fp.a = r.user_id)
      )
    )
  )
);