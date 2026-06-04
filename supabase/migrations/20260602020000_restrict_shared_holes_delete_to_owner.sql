-- Least-privilege hardening: only the round OWNER may DELETE shared hole rows.
--
-- scramble_holes / skins_holes store every group's/player's scores on ONE shared
-- row per hole. Their DELETE policy was `owner OR can_access_game(game_id)`, so
-- ANY participant could delete those rows — wiping every group's scores. The app
-- only ever deletes them in the owner's `deleteGame()` (round deletion), which is
-- admin-gated in the UI, so this is latent, not normally reachable — but a
-- participant has no legitimate reason to DELETE a shared row (score removal is a
-- jsonb UPDATE, not a row delete). Restrict DELETE to the owner, matching the
-- stroke-play `holes` table (already owner-only).
--
-- Safe + deploy-decoupled: the owner's delete still passes (owner branch), the FK
-- ON DELETE CASCADE from *_games is unaffected (cascade deletes don't check child
-- RLS), and no participant flow deletes these rows. INSERT/UPDATE (the merge RPCs)
-- are untouched, so scoring is unaffected.
--
-- Banker is intentionally NOT included: banker_hole_scores also carries an
-- "Allow all for authenticated" ALL policy that would override a tightened DELETE
-- policy; restricting it needs that broader policy reworked first (separate
-- change). Tracked as a follow-up.

-- Scramble -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete scramble holes" ON public.scramble_holes;
CREATE POLICY "Round owner can delete scramble holes"
  ON public.scramble_holes
  FOR DELETE
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.scramble_games g
    WHERE g.id = scramble_holes.game_id
      AND g.user_id = auth.uid()
  ));

-- Skins --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete skins holes" ON public.skins_holes;
CREATE POLICY "Round owner can delete skins holes"
  ON public.skins_holes
  FOR DELETE
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.skins_games g
    WHERE g.id = skins_holes.game_id
      AND g.user_id = auth.uid()
  ));
