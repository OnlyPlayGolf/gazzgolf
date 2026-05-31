-- Adjust holes uniqueness to support per-player entries and allow round players to save their own holes
ALTER TABLE public.holes DROP CONSTRAINT IF EXISTS holes_round_hole_unique;

-- Ensure uniqueness per player per round/hole
ALTER TABLE public.holes
ADD CONSTRAINT holes_round_hole_player_unique UNIQUE (round_id, hole_number, player_id);

-- Allow round players to insert their own holes
DROP POLICY IF EXISTS "Round players can insert their own holes" ON public.holes;
CREATE POLICY "Round players can insert their own holes"
ON public.holes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = holes.round_id
      AND rp.user_id = auth.uid()
  )
  AND (player_id = auth.uid())
);

-- Allow round players to update their own holes
DROP POLICY IF EXISTS "Round players can update their own holes" ON public.holes;
CREATE POLICY "Round players can update their own holes"
ON public.holes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = holes.round_id
      AND rp.user_id = auth.uid()
  )
  AND (player_id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = holes.round_id
      AND rp.user_id = auth.uid()
  )
  AND (player_id = auth.uid())
);
