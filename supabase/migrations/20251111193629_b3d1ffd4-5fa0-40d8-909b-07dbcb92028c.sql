-- Replace holes policies to handle rounds without round_players gracefully
DROP POLICY IF EXISTS "Insert holes - owner or round player" ON public.holes;
DROP POLICY IF EXISTS "Update holes - owner or round player" ON public.holes;

-- Allow inserting a hole when:
-- 1) You are the round owner, OR
-- 2) You are a listed round player for that round, OR
-- 3) The round has no round_players yet (single-player), and you're inserting your own row
CREATE POLICY "holes_insert_owner_player_or_empty_round"
ON public.holes
FOR INSERT
TO authenticated
WITH CHECK (
  (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = holes.round_id AND r.user_id = auth.uid()
    )
  )
  OR (
    holes.player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = holes.round_id AND rp.user_id = auth.uid()
    )
  )
  OR (
    holes.player_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.round_players rp2
      WHERE rp2.round_id = holes.round_id
    )
  )
);

-- Allow updating a hole when owner OR you're updating your own row and you're in the round
CREATE POLICY "holes_update_owner_or_own_player"
ON public.holes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
  OR (
    holes.player_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.round_players rp
        WHERE rp.round_id = holes.round_id AND rp.user_id = auth.uid()
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.round_players rp2
        WHERE rp2.round_id = holes.round_id
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
  OR (
    holes.player_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.round_players rp
        WHERE rp.round_id = holes.round_id AND rp.user_id = auth.uid()
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.round_players rp2
        WHERE rp2.round_id = holes.round_id
      )
    )
  )
);
