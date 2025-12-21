-- Allow participants and their friends to see round participation rows
-- (Needed so a friend's profile can list rounds where that friend participated)

DROP POLICY IF EXISTS "Participants can view their own round_players" ON public.round_players;
CREATE POLICY "Participants can view their own round_players"
ON public.round_players
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Friends can view their friends' round_players" ON public.round_players;
CREATE POLICY "Friends can view their friends' round_players"
ON public.round_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = round_players.user_id)
       OR (fp.b = auth.uid() AND fp.a = round_players.user_id)
  )
);
