-- Allow friends to view round_players for rounds they can see
CREATE POLICY "Friends can view round players"
ON public.round_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = round_players.round_id
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