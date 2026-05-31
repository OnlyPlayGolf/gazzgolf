-- Simplify holes RLS for single-player Pro Stats
-- If you own the round, you can insert/update ANY hole (including your own)
DROP POLICY IF EXISTS "holes_insert_owner_player_or_empty_round" ON public.holes;
DROP POLICY IF EXISTS "holes_update_owner_or_own_player" ON public.holes;

CREATE POLICY "holes_insert_simple"
ON public.holes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
);

CREATE POLICY "holes_update_simple"
ON public.holes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
);