-- Allow users to see a friend's participated rounds (even when the friend is not the round owner)
-- Uses SECURITY DEFINER functions to avoid RLS recursion between rounds <-> round_players policies

CREATE OR REPLACE FUNCTION public.is_friend_of_round_participant(_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.round_players rp
    JOIN public.friends_pairs fp
      ON (
        (fp.a = auth.uid() AND fp.b = rp.user_id)
        OR
        (fp.b = auth.uid() AND fp.a = rp.user_id)
      )
    WHERE rp.round_id = _round_id
  );
$$;

-- ROUNDS: friends can view rounds where any of their friends participated
DROP POLICY IF EXISTS "Friends can view rounds where friend participated" ON public.rounds;
CREATE POLICY "Friends can view rounds where friend participated"
ON public.rounds
FOR SELECT
USING (public.is_friend_of_round_participant(id));

-- HOLES: friends can view holes for rounds where any of their friends participated
DROP POLICY IF EXISTS "Friends can view holes where friend participated" ON public.holes;
CREATE POLICY "Friends can view holes where friend participated"
ON public.holes
FOR SELECT
USING (public.is_friend_of_round_participant(round_id));
