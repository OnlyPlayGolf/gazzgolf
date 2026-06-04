-- pgTAP: banker_hole_scores (game_id, hole_number, player_order) unique index.
--
-- WHY THIS EXISTS
--   Banker's clobber fix replaced delete-all-then-insert with a per-row UPSERT on
--   (game_id, hole_number, player_order). PostgREST's upsert needs a unique
--   constraint to target with ON CONFLICT — player_id is nullable (guests) so the
--   slot (player_order) is the stable per-hole key. If this index regresses, the
--   upsert silently turns back into duplicate-inserting (the clobber returns) or
--   errors outright. This pins: the index rejects duplicate slots, ON CONFLICT
--   updates in place, and distinct slots coexist.
--
-- Pure index/constraint behavior — no RLS needed, so this runs as the pgTAP
-- superuser. In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

-- FK parent (ON DELETE CASCADE) — banker_hole_scores.game_id references it.
INSERT INTO public.banker_games (id, created_by)
VALUES ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Slot 1, hole 1.
INSERT INTO public.banker_hole_scores (game_id, hole_number, player_order, strokes)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 1, 4);

SELECT is(
  (SELECT count(*)::int FROM public.banker_hole_scores
   WHERE game_id = '11111111-1111-1111-1111-111111111111' AND hole_number = 1),
  1, 'fixture: one row for hole 1 slot 1');

-- 1. A second plain INSERT for the SAME (game, hole, slot) violates the unique
--    index — this is what makes the upsert necessary and the clobber impossible.
SELECT throws_ok(
  $$ INSERT INTO public.banker_hole_scores (game_id, hole_number, player_order, strokes)
     VALUES ('11111111-1111-1111-1111-111111111111', 1, 1, 99) $$,
  '23505', NULL,
  'duplicate (game, hole, player_order) is rejected by the unique index');

-- 2. The client's UPSERT path: ON CONFLICT updates in place instead of duplicating.
INSERT INTO public.banker_hole_scores (game_id, hole_number, player_order, strokes)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 1, 5)
ON CONFLICT (game_id, hole_number, player_order)
DO UPDATE SET strokes = EXCLUDED.strokes;

SELECT is(
  (SELECT strokes FROM public.banker_hole_scores
   WHERE game_id = '11111111-1111-1111-1111-111111111111'
     AND hole_number = 1 AND player_order = 1),
  5, 'ON CONFLICT upsert updated the existing slot in place');

SELECT is(
  (SELECT count(*)::int FROM public.banker_hole_scores
   WHERE game_id = '11111111-1111-1111-1111-111111111111' AND hole_number = 1),
  1, 'upsert did NOT create a duplicate row');

-- 3. A different slot (player_order 2) on the same hole coexists.
INSERT INTO public.banker_hole_scores (game_id, hole_number, player_order, strokes)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 2, 6)
ON CONFLICT (game_id, hole_number, player_order)
DO UPDATE SET strokes = EXCLUDED.strokes;

SELECT is(
  (SELECT count(*)::int FROM public.banker_hole_scores
   WHERE game_id = '11111111-1111-1111-1111-111111111111' AND hole_number = 1),
  2, 'a distinct player_order slot coexists on the same hole');

SELECT * FROM finish();
ROLLBACK;
