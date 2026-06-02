-- pgTAP: delete-round for the stroke-play cleanup model (rounds/holes/round_players).
--
-- Stroke play uses a different shape than the *_games formats: a `rounds` row with
-- `holes` (per player/hole) and `round_players`, all FK ON DELETE CASCADE. This
-- pins the same two guarantees as test 08, for this model:
--   1. A non-owner cannot delete the round or its holes (owner-only).
--   2. Deleting the round CASCADE-cleans holes AND round_players (no orphans).
--
-- (round_players DELETE policies — leave vs owner-cleanup — are covered in detail
-- by test 02; here we assert the cascade on full round deletion.)
--
-- RLS via SET LOCAL ROLE authenticated. Seeded users A (owner), B (participant).
-- In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

INSERT INTO public.rounds (id, user_id, course_name)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course');

INSERT INTO public.round_players (round_id, user_id) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO public.holes (round_id, hole_number, par, score) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 4, 4),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 2, 4, 5);

-- ---- Non-owner B tries to delete ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

-- 1. B can't delete the holes (owner-only).
DELETE FROM public.holes WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT is(
  (SELECT count(*)::int FROM public.holes
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  2, 'a non-owner CANNOT delete the round''s holes');

-- 2. B can't delete the round.
DELETE FROM public.rounds WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.rounds
   WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1, 'a non-owner CANNOT delete the round');

-- ---- Owner A deletes the round ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
DELETE FROM public.rounds WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
RESET ROLE;

-- 3. Round gone.
SELECT is(
  (SELECT count(*)::int FROM public.rounds
   WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0, 'the owner CAN delete the round');

-- 4 & 5. CASCADE cleaned holes AND round_players.
SELECT is(
  (SELECT count(*)::int FROM public.holes
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0, 'deleting the round CASCADE-cleans holes');
SELECT is(
  (SELECT count(*)::int FROM public.round_players
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0, 'deleting the round CASCADE-cleans round_players');

SELECT * FROM finish();
ROLLBACK;
