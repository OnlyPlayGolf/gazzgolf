-- Fix holes RLS to allow round players (not only owners) to save their own holes

-- Drop restrictive owner-only policies that block non-owners
DROP POLICY IF EXISTS "Round owner can insert holes for all players" ON public.holes;
DROP POLICY IF EXISTS "Round owner can update holes for all players" ON public.holes;

-- Create permissive policies allowing owner OR round player (for their own row)
CREATE POLICY "Insert holes - owner or round player"
ON public.holes
FOR INSERT
TO authenticated
WITH CHECK (
  -- Round owner can insert
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id
      AND r.user_id = auth.uid()
  )
  OR (
    -- Round player can insert their own rows
    holes.player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = holes.round_id
        AND rp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Update holes - owner or round player"
ON public.holes
FOR UPDATE
TO authenticated
USING (
  -- Owner can update
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id
      AND r.user_id = auth.uid()
  )
  OR (
    -- Round player can update their own rows
    holes.player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = holes.round_id
        AND rp.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Ensure updates keep the row owned by either the owner or same player
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id
      AND r.user_id = auth.uid()
  )
  OR (
    holes.player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = holes.round_id
        AND rp.user_id = auth.uid()
    )
  )
);
