-- pgTAP: public.merge_scramble_hole_scores(...) — the EVENT-CRITICAL write path.
--
-- WHY THIS EXISTS
--   A multi-group scramble is one scramble_games row whose groups all write the
--   SAME shared scramble_holes row (keyed game_id, hole_number). The original bug:
--   the client FULL-REPLACED team_scores, so two groups saving the same hole (or a
--   stale/offline save) wiped each other — permanent loss on the leaderboard's
--   source of truth. The fix is this merge RPC: each group sends ONLY its own
--   team's slot and the server merges with jsonb `||` under the ON CONFLICT row
--   lock. This test pins the no-clobber guarantee AND that it runs through the
--   REAL participant path (SECURITY INVOKER + scramble_holes RLS + can_access_game).
--
-- HOW THIS IS TESTED CORRECTLY
--   pgTAP runs as the postgres SUPERUSER (bypasses RLS). To exercise the actual
--   write a participant's request takes, we SET LOCAL ROLE authenticated and set
--   the JWT sub claim auth.uid() reads (same as tests 02/03). A participant is
--   anyone with a public.round_status row for the game (can_access_game gate);
--   round_id is stored LOWERCASE to match uuid::text (the CLAUDE.md casing canon).
--
-- Fixtures: seeded users A (aaaa…, owner) and B (bbbb…, participant). C is a
-- synthetic stranger uuid (no round_status) — auth.uid() needs no real row for the
-- RLS check. Everything is in-txn and rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

-- A scramble game owned by A.
INSERT INTO public.scramble_games (id, user_id, course_name)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course');

-- Participant round_status rows (round_id stored LOWERCASE = game_id::text).
-- A is also the owner, but a real round always has A's own round_status too.
INSERT INTO public.round_status (round_id, status, user_id, game_format) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'active',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Scramble'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'active',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scramble');

-- 1. Fixture sanity: no hole row yet.
SELECT is(
  (SELECT count(*)::int FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'fixture: no scramble_holes row before any merge'
);

-- ---- Group 1, owned by A (authenticated) saves hole 1 ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT public.merge_scramble_hole_scores(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 1, 4, 1,
  '{"team-1": {"score": 4}}'::jsonb,
  '{"team-1": {"drives": 2}}'::jsonb
);
RESET ROLE;

-- 2 & 3. Owner's write created the row with ONLY team-1.
SELECT ok(
  (SELECT team_scores ? 'team-1' FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  'after owner save: team-1 present'
);
SELECT ok(
  NOT (SELECT team_scores ? 'team-2' FROM public.scramble_holes
       WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  'after owner save: team-2 absent (only group 1 has saved)'
);

-- ---- Group 2, played by participant B (authenticated) saves the SAME hole ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT public.merge_scramble_hole_scores(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 1, 4, 1,
  '{"team-2": {"score": 5}}'::jsonb,
  '{"team-2": {"drives": 3}}'::jsonb
);
RESET ROLE;

-- 4 & 5. THE no-clobber guarantee: B's save must NOT wipe A's team-1.
SELECT ok(
  (SELECT team_scores ? 'team-1' FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  'after participant save: team-1 STILL present (no clobber)'
);
SELECT ok(
  (SELECT team_scores ? 'team-2' FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  'after participant save: team-2 present (merged in)'
);

-- 6. Tee shots merge the same way — both groups' tee-shot slots coexist.
SELECT ok(
  (SELECT team_tee_shots ? 'team-1' AND team_tee_shots ? 'team-2'
   FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  'team_tee_shots holds both groups after merge'
);

-- ---- B re-saves only team-2 (updated), empty tee shots ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT public.merge_scramble_hole_scores(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 1, 4, 1,
  '{"team-2": {"score": 6}}'::jsonb,
  '{}'::jsonb
);
RESET ROLE;

-- 7 & 8. Partial re-merge: team-1 untouched, team-2 updated.
SELECT is(
  (SELECT team_scores->'team-1'->>'score' FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  '4',
  'partial re-merge leaves team-1 score untouched'
);
SELECT is(
  (SELECT team_scores->'team-2'->>'score' FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1),
  '6',
  'partial re-merge updates team-2 score'
);

-- 9. A stranger (no round_status, not owner) cannot write — RLS blocks the INSERT.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT throws_ok(
  $$ SELECT public.merge_scramble_hole_scores(
       'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 2, 4, 2,
       '{"team-9": {"score": 9}}'::jsonb, '{}'::jsonb) $$,
  '42501', NULL,
  'a stranger (no round_status) is blocked by RLS from writing scramble holes'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
