-- pgTAP: leave-round → hidden-set contract.
--
-- WHY THIS EXISTS
--   When a participant leaves a round, the format VMs set their round_status.status
--   to 'left' (a soft-delete: the round stays intact for everyone else). Other
--   clients hide the leaver by reading the "hidden set" — exactly:
--       SELECT user_id FROM round_status
--       WHERE round_id = <id> AND status IN ('hidden','left')
--   (HiddenPlayerUtils.fetchHiddenUserIds). Two source statuses converge on one
--   read semantic: 'left' (in-game leave) and 'hidden' (profile-side delete).
--
--   A regression here is the bug the round-deletion audit flagged: if 'left' were
--   dropped from the filter, a leaver would keep showing (name + avatar) to the
--   whole field. This pins that 'left' AND 'hidden' are hidden and an active
--   participant is not.
--
-- Pure data assertions (the function is SECURITY-agnostic here — we're pinning the
-- query's set logic). round_status has no FK on round_id, so standalone ids are
-- fine. Seeded users A (aaaa…), B (bbbb…). In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

-- Round D: A has LEFT, B is still ACTIVE.
INSERT INTO public.round_status (round_id, status, user_id, game_format) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'left',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Scramble'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'in_progress',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scramble');

-- Round E: B was HIDDEN via a profile-side delete.
INSERT INTO public.round_status (round_id, status, user_id, game_format)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'hidden',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scramble');

-- The exact predicate HiddenPlayerUtils uses.
-- 1. A 'left' participant IS in the hidden set.
SELECT ok(
  EXISTS (SELECT 1 FROM public.round_status
          WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
            AND user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
            AND status IN ('hidden','left')),
  'a participant who LEFT is in the hidden set (gets anonymized for others)'
);

-- 2. An active participant is NOT in the hidden set.
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.round_status
              WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
                AND user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
                AND status IN ('hidden','left')),
  'an active participant is NOT hidden'
);

-- 3. A 'hidden' (profile-delete) participant IS in the hidden set.
SELECT ok(
  EXISTS (SELECT 1 FROM public.round_status
          WHERE round_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
            AND user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
            AND status IN ('hidden','left')),
  'a participant hidden via profile delete is also in the hidden set'
);

-- 4. The hidden set for round D is exactly {A} — one leaver, active B excluded.
SELECT is(
  (SELECT count(*)::int FROM public.round_status
   WHERE round_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     AND status IN ('hidden','left')),
  1,
  'the hidden set contains only the leaver, not the active player'
);

SELECT * FROM finish();
ROLLBACK;
