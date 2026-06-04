-- Fix for the scramble shared-game score-clobber bug.
--
-- Root cause: the client saved the ENTIRE team_scores dict per hole and the
-- upsert FULL-REPLACED the row. In a multi-group scramble (one game, many groups
-- sharing scramble_holes rows), a stale/offline save — or two groups saving the
-- same hole at once — overwrote other groups' scores (permanent data loss on the
-- leaderboard's source of truth).
--
-- Fix: a merge RPC. The client sends ONLY its own group's team scores/tee-shots as
-- `_partial` / `_partial_tee_shots`; the server merges them into the existing row
-- with `||` in a single statement. Postgres takes a row lock on ON CONFLICT DO
-- UPDATE, so concurrent callers serialize and each merges on top of the prior
-- committed value — no lost updates. SECURITY INVOKER (default) so the existing
-- scramble_holes RLS (can_access_game / owner) still gates writes.
DROP FUNCTION IF EXISTS public.merge_scramble_hole_scores(uuid, integer, integer, integer, jsonb);

CREATE OR REPLACE FUNCTION public.merge_scramble_hole_scores(
    _game_id            uuid,
    _hole_number        integer,
    _par                integer,
    _stroke_index       integer,
    _partial            jsonb,
    _partial_tee_shots  jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO public.scramble_holes (game_id, hole_number, par, stroke_index,
                                       team_scores, team_tee_shots, updated_at)
    VALUES (_game_id, _hole_number, _par, _stroke_index, _partial, _partial_tee_shots, now())
    ON CONFLICT (game_id, hole_number)
    DO UPDATE SET team_scores    = COALESCE(scramble_holes.team_scores,    '{}'::jsonb) || EXCLUDED.team_scores,
                  team_tee_shots = COALESCE(scramble_holes.team_tee_shots, '{}'::jsonb) || EXCLUDED.team_tee_shots,
                  updated_at     = now();
$$;

GRANT EXECUTE ON FUNCTION public.merge_scramble_hole_scores(uuid, integer, integer, integer, jsonb, jsonb) TO authenticated;
