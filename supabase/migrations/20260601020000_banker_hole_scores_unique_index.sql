-- Fix for the Banker shared-hole score-clobber bug (enables the client-side fix).
--
-- Root cause: the client saved each hole's scores by DELETE-ing every
-- banker_hole_scores row for (game_id, hole_number) and re-INSERTing a row per
-- player from the saving device's local view (strokes = nil for players it
-- hadn't scored). In a multi-device Banker game (all participants can score),
-- two concurrent saves race: one device's delete wipes the other's just-inserted
-- rows, and the last writer's partial view (with nil strokes for the other
-- player) overwrites real scores — permanent loss. Verified:
-- scripts/banker_clobber_verify.py shows 10/10 concurrent same-hole saves lost.
--
-- Fix (client, in OnlyPlayGolf): write only the rows this device actually scored
-- and UPSERT them instead of delete-all-then-insert. PostgREST upsert needs a
-- unique constraint to target with ON CONFLICT. player_id is nullable (guests),
-- so it can't be the key — but player_order (the slot, 1..N) is always set, so
-- (game_id, hole_number, player_order) is the natural per-hole-per-slot key and
-- covers guests too. With this index the harness shows 0/10 lost.
--
-- IMPORTANT: deploy this migration BEFORE shipping the app build that upserts on
-- (game_id, hole_number, player_order) — without the index the upsert errors and
-- Banker saves fail.

-- 1. Remove any pre-existing duplicate (game_id, hole_number, player_order) rows
--    (which the old delete-insert race could have left), keeping the most recently
--    updated row, so the unique index can be created without error.
DELETE FROM public.banker_hole_scores a
USING public.banker_hole_scores b
WHERE a.game_id = b.game_id
  AND a.hole_number = b.hole_number
  AND a.player_order = b.player_order
  AND a.player_order IS NOT NULL
  AND (COALESCE(a.updated_at, a.created_at), a.id)
    < (COALESCE(b.updated_at, b.created_at), b.id);

-- 2. The unique key the client upserts on. NULL player_order rows (if any old
--    data exists) are treated as distinct by Postgres and are left untouched;
--    the client always sets player_order.
CREATE UNIQUE INDEX IF NOT EXISTS banker_hole_scores_game_hole_order_key
    ON public.banker_hole_scores (game_id, hole_number, player_order);
