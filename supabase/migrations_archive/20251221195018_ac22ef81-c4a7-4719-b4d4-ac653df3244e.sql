
-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Participants can view rounds they're in" ON public.rounds;
DROP POLICY IF EXISTS "Participants can update rounds they're in" ON public.rounds;

-- Create a security definer function to check if user is a participant
CREATE OR REPLACE FUNCTION public.is_round_participant(_user_id uuid, _round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.round_players
    WHERE round_id = _round_id AND user_id = _user_id
  )
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Participants can view rounds they're in"
ON public.rounds
FOR SELECT
USING (public.is_round_participant(auth.uid(), id));

CREATE POLICY "Participants can update rounds they're in"
ON public.rounds
FOR UPDATE
USING (public.is_round_participant(auth.uid(), id))
WITH CHECK (public.is_round_participant(auth.uid(), id));
