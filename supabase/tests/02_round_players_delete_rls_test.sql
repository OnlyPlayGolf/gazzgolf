-- pgTAP: round_players DELETE RLS policies (the round-cleanup canon).
--
-- WHY THIS EXISTS (CLAUDE.md: "round_players needs explicit DELETE policies for
-- round cleanup to work")
--   Round deletion/leave flows depend on exactly two DELETE policies (verified
--   from the live policy bodies):
--     • "Players can delete own round_player" / "Users can remove themselves":
--         USING (auth.uid() = user_id)   -- a player may remove their OWN row
--     • "Round owner can delete round_players":
--         USING (round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid()))
--   If either regresses, "leave round" or "delete round" silently stops cleaning
--   up round_players — a class of bug that has bitten this project.
--
-- HOW THIS IS TESTED CORRECTLY
--   pgTAP runs as the postgres SUPERUSER, which BYPASSES RLS. To actually
--   exercise the policies we `SET LOCAL ROLE authenticated` and set the JWT sub
--   claim that auth.uid() reads. (RLS on round_players: enabled=t, forced=f —
--   so non-owner roles like `authenticated` are subject to it. Verified.)
--
-- Fixtures: seeded users A (aaaa…) and B (bbbb…). Round D is owned by A; both
-- A and B are players on it. Everything is created in-txn and rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

INSERT INTO public.rounds (id, user_id, course_name)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course');

INSERT INTO public.round_players (round_id, user_id) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Sanity: 2 player rows exist before any RLS-scoped deletes.
SELECT is(
  (SELECT count(*)::int FROM public.round_players
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  2,
  'fixture: round D has 2 player rows (A and B)'
);

-- ---- Act as player B (authenticated) ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

-- 1. B can remove B's OWN row.
DELETE FROM public.round_players WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT is(
  (SELECT count(*)::int FROM public.round_players
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     AND user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'a player can delete their OWN round_player row (leave round)'
);

-- 2. B (not the round owner) CANNOT remove A's row — RLS blocks it (0 deleted).
DELETE FROM public.round_players WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT is(
  (SELECT count(*)::int FROM public.round_players
   WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'a non-owner player CANNOT delete another player''s row'
);

RESET ROLE;

-- ---- Act as the round owner A (authenticated) ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- Re-add B so the owner has someone else's row to clean up.
-- (INSERT policy allows the round owner to add players.)
INSERT INTO public.round_players (round_id, user_id)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- 3. The round OWNER can delete ANY player's row on their round (cleanup path).
DELETE FROM public.round_players
WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  AND user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT is(
  (SELECT count(*)::int FROM public.round_players
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     AND user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'the round owner CAN delete another player''s row (round cleanup)'
);

-- 4. Owner removes their own remaining row → round fully cleaned up.
DELETE FROM public.round_players
WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  AND user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT is(
  (SELECT count(*)::int FROM public.round_players
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'round_players is fully cleared after owner cleanup (delete-round path works)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
