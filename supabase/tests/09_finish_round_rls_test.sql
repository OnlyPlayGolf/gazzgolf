-- pgTAP: finish-round RLS (scramble).
--
-- Finishing a round = UPDATE scramble_games SET is_finished = true (+ round_status
-- → 'completed'). scramble_games UPDATE RLS is `owner OR can_access_game`, and the
-- app gates the Finish button to the admin (the admin-only-finish work). This pins
-- the hard boundary: a user with NO access to the game cannot finish it.
--
-- NOTE (documented, intentionally NOT pinned): a participant (has a round_status
-- row) CAN also flip is_finished at the RLS layer — the admin-only-finish gate is
-- app-side, not RLS. Tightening scramble_games UPDATE to owner-only is a possible
-- follow-up but UPDATE has several call sites (settings, winner, finish) that need
-- vetting first, so it is left as-is here. We assert only the unambiguous boundary
-- (a stranger cannot finish) so this test doesn't go brittle if that's tightened.
--
-- RLS exercised via SET LOCAL ROLE authenticated. Seeded user A (owner); C is a
-- synthetic stranger (no round_status). In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

INSERT INTO public.scramble_games (id, user_id, course_name, is_finished)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course', false);

-- 1. A stranger (no access to the game) cannot finish it — UPDATE is filtered out.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
UPDATE public.scramble_games SET is_finished = true
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
RESET ROLE;
SELECT is(
  (SELECT is_finished FROM public.scramble_games
   WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  false,
  'a stranger with no game access CANNOT finish the round'
);

-- 2. The owner CAN finish.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
UPDATE public.scramble_games SET is_finished = true, winning_team = 'teamA'
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
RESET ROLE;
SELECT is(
  (SELECT is_finished FROM public.scramble_games
   WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  true,
  'the owner CAN finish the round'
);

-- 3. The owner's winning_team write landed too.
SELECT is(
  (SELECT winning_team FROM public.scramble_games
   WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'teamA',
  'the owner''s finish also records the result (winning_team)'
);

SELECT * FROM finish();
ROLLBACK;
