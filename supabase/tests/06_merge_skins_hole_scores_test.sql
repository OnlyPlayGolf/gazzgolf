-- pgTAP: public.merge_skins_hole_scores(uuid, int, jsonb) — shared-game no-clobber.
--
-- WHY THIS EXISTS
--   skins_holes stores all players' scores in one jsonb dict (player_scores) on a
--   shared (game_id, hole_number) row. The old client full-replaced it, so in a
--   multi-group / multi-device Skins game a stale/offline or concurrent same-hole
--   save wiped another group's scores. The fix mirrors scramble: the client sends
--   only its own slots in _row->'player_scores' and the server merges with jsonb ||
--   under the ON CONFLICT row lock. This pins the no-clobber guarantee through the
--   REAL participant path (SECURITY INVOKER + skins_holes RLS + can_access_game).
--
-- Setup mirrors test 04. Seeded users A (aaaa…, owner) and B (bbbb…, participant);
-- C (cccc…) is a synthetic stranger. In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

INSERT INTO public.skins_games (id, user_id, course_name)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course');

INSERT INTO public.round_status (round_id, status, user_id, game_format) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'active',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Skins'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'active',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Skins');

-- 1. No row yet.
SELECT is(
  (SELECT count(*)::int FROM public.skins_holes
   WHERE game_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  0, 'fixture: no skins_holes row before any merge');

-- ---- Owner A saves hole 1 with player-a's score ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT public.merge_skins_hole_scores(
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 1,
  '{"par": 4, "stroke_index": 1, "player_scores": {"player-a": 4},
    "skins_available": 1, "is_carryover": false}'::jsonb);
RESET ROLE;

-- 2 & 3. Row created with only player-a.
SELECT ok(
  (SELECT player_scores ? 'player-a' FROM public.skins_holes
   WHERE game_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND hole_number = 1),
  'after owner save: player-a present');
SELECT ok(
  NOT (SELECT player_scores ? 'player-b' FROM public.skins_holes
       WHERE game_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND hole_number = 1),
  'after owner save: player-b absent');

-- ---- Participant B saves the SAME hole with player-b's score ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT public.merge_skins_hole_scores(
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 1,
  '{"par": 4, "stroke_index": 1, "player_scores": {"player-b": 5},
    "skins_available": 1, "is_carryover": false}'::jsonb);
RESET ROLE;

-- 4 & 5. THE no-clobber guarantee: B's save preserves player-a and adds player-b.
SELECT ok(
  (SELECT player_scores ? 'player-a' FROM public.skins_holes
   WHERE game_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND hole_number = 1),
  'after participant save: player-a STILL present (no clobber)');
SELECT is(
  (SELECT player_scores->>'player-b' FROM public.skins_holes
   WHERE game_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND hole_number = 1),
  '5', 'after participant save: player-b merged in');

-- 6. A stranger cannot write — RLS blocks the INSERT (fresh hole 2).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT throws_ok(
  $$ SELECT public.merge_skins_hole_scores(
       'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 2,
       '{"par": 4, "stroke_index": 2, "player_scores": {"player-x": 9},
         "skins_available": 1, "is_carryover": false}'::jsonb) $$,
  '42501', NULL,
  'a stranger (no round_status) is blocked by RLS from writing skins holes');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
