-- pgTAP: delete-round RLS + cascade for a shared-row format (scramble).
--
-- WHY THIS EXISTS
--   Deleting a round must (a) be possible ONLY for the owner and (b) clean up
--   everything. Two guarantees are pinned here:
--     1. A participant (non-owner) CANNOT delete the shared scramble_holes rows
--        or the scramble_games row — so one player can't wipe the whole field.
--        (scramble_holes DELETE was tightened from `owner OR can_access_game` to
--        owner-only; this is the regression guard for that.)
--     2. When the owner deletes the scramble_games row, scramble_holes is removed
--        by the FK ON DELETE CASCADE — no orphaned score rows.
--
-- RLS is exercised for real via SET LOCAL ROLE authenticated + the JWT sub claim
-- (the pgTAP superuser would bypass it). Seeded users A (aaaa…, owner) and B
-- (bbbb…, participant). In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

INSERT INTO public.scramble_games (id, user_id, course_name)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course');

-- B is a real participant (has a round_status row) — and STILL must not delete.
INSERT INTO public.round_status (round_id, status, user_id, game_format)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'active',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scramble');

INSERT INTO public.scramble_holes (game_id, hole_number, par, team_scores) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1, 4, '{"teamA": 4}'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 2, 4, '{"teamA": 5}');

-- ---- Participant B (authenticated) tries to wipe the round ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

-- 1. B's DELETE of the shared hole rows is filtered out by RLS (0 rows removed).
DELETE FROM public.scramble_holes WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  2,
  'a participant CANNOT delete shared scramble_holes (owner-only)'
);

-- 2. B cannot delete the game row either (owner-only).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
DELETE FROM public.scramble_games WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.scramble_games
   WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'a participant CANNOT delete the scramble_games row'
);

-- ---- Owner A (authenticated) performs the real deletion ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- 3. The owner CAN delete a hole row directly (the app's deleteGame does this).
DELETE FROM public.scramble_holes
WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND hole_number = 1;
SELECT is(
  (SELECT count(*)::int FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'the owner CAN delete scramble_holes directly'
);

-- 4. The owner CAN delete the game row.
DELETE FROM public.scramble_games WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.scramble_games
   WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'the owner CAN delete the scramble_games row'
);

-- 5. CASCADE: deleting the game removed the remaining hole row (no orphans).
SELECT is(
  (SELECT count(*)::int FROM public.scramble_holes
   WHERE game_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'deleting the game CASCADE-cleans scramble_holes (no orphaned scores)'
);

-- 6. round_status has no FK, so it is NOT cascaded — the app deletes it
--    explicitly. Pin that it survives a game delete (documents why the app must
--    delete it, and why a stray row would ghost in Friends-on-Course).
SELECT is(
  (SELECT count(*)::int FROM public.round_status
   WHERE round_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'round_status is NOT cascaded (app must delete it explicitly — it does)'
);

SELECT * FROM finish();
ROLLBACK;
