
-- Add RLS policy for participants to view rounds they're part of
CREATE POLICY "Participants can view rounds they're in"
ON public.rounds
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = rounds.id AND rp.user_id = auth.uid()
  )
);

-- Add RLS policy for participants to update rounds they're part of
CREATE POLICY "Participants can update rounds they're in"
ON public.rounds
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = rounds.id AND rp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = rounds.id AND rp.user_id = auth.uid()
  )
);

-- Add RLS policy for participants to insert holes in rounds they're part of
CREATE POLICY "Participants can insert holes"
ON public.holes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = holes.round_id AND rp.user_id = auth.uid()
  )
);

-- Add RLS policy for participants to update holes in rounds they're part of  
CREATE POLICY "Participants can update holes"
ON public.holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = holes.round_id AND rp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = holes.round_id AND rp.user_id = auth.uid()
  )
);
