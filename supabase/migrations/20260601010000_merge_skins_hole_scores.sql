-- Fix for the Skins shared-game score-clobber bug (same class as scramble's).
--
-- skins_holes stores all players' scores in a single jsonb dict (player_scores)
-- on a shared (game_id, hole_number) row. The client saved the WHOLE dict and the
-- upsert full-replaced it, so in a multi-group / multi-device Skins game a
-- stale/offline or concurrent same-hole save wiped another group's scores.
--
-- Fix: a merge RPC. The client sends only its own group's slots in
-- _row->'player_scores'; the server merges them with jsonb `||` under a row lock
-- (race-free). The other columns are game-level (winner/skins recomputed on load)
-- or per-stats-player and are replaced as before — they converge. SECURITY
-- INVOKER so skins_holes RLS still gates writes. _row is the existing
-- SkinsHoleInsert as jsonb (with player_scores filtered to the saving group).
CREATE OR REPLACE FUNCTION public.merge_skins_hole_scores(
    _game_id      uuid,
    _hole_number  integer,
    _row          jsonb
) RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO public.skins_holes (
        game_id, hole_number, par, stroke_index, player_scores, skins_available,
        winner_player, is_carryover, fairway, gir, short_game_shots,
        short_game_type, putts, stats_player_id, updated_at)
    VALUES (
        _game_id, _hole_number,
        (_row->>'par')::int, (_row->>'stroke_index')::int,
        COALESCE(_row->'player_scores', '{}'::jsonb),
        (_row->>'skins_available')::int, _row->>'winner_player', (_row->>'is_carryover')::boolean,
        _row->>'fairway', (_row->>'gir')::boolean, (_row->>'short_game_shots')::int,
        _row->>'short_game_type', (_row->>'putts')::int, (_row->>'stats_player_id')::uuid, now())
    ON CONFLICT (game_id, hole_number)
    DO UPDATE SET
        player_scores    = COALESCE(skins_holes.player_scores, '{}'::jsonb) || EXCLUDED.player_scores,
        skins_available  = EXCLUDED.skins_available,
        winner_player    = EXCLUDED.winner_player,
        is_carryover     = EXCLUDED.is_carryover,
        par              = EXCLUDED.par,
        stroke_index     = EXCLUDED.stroke_index,
        fairway          = EXCLUDED.fairway,
        gir              = EXCLUDED.gir,
        short_game_shots = EXCLUDED.short_game_shots,
        short_game_type  = EXCLUDED.short_game_type,
        putts            = EXCLUDED.putts,
        stats_player_id  = EXCLUDED.stats_player_id,
        updated_at       = now();
$$;

GRANT EXECUTE ON FUNCTION public.merge_skins_hole_scores(uuid, integer, jsonb) TO authenticated;
