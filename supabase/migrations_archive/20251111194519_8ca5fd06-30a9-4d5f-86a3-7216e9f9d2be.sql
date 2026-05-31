-- Loosen holes RLS to allow Pro Stats saves for the current user regardless of round ownership
-- Inserts/updates are only allowed for rows where player_id = auth.uid()

DROP POLICY IF EXISTS "holes_insert_simple" ON public.holes;
DROP POLICY IF EXISTS "holes_update_simple" ON public.holes;

CREATE POLICY "holes_insert_player_owned"
ON public.holes
FOR INSERT
TO authenticated
WITH CHECK (
  holes.player_id = auth.uid()
);

CREATE POLICY "holes_update_player_owned"
ON public.holes
FOR UPDATE
TO authenticated
USING (
  holes.player_id = auth.uid()
)
WITH CHECK (
  holes.player_id = auth.uid()
);
