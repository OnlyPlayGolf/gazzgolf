-- pgTAP: public.can_access_game(text) — the WRITE gate for shared hole rows.
--
-- WHY THIS EXISTS
--   scramble_holes / skins_holes INSERT+UPDATE RLS is `owner OR
--   can_access_game(game_id)`. can_access_game returns true iff the caller has a
--   public.round_status row for the game (round_id::text = _game_id AND user_id =
--   auth.uid()). So every event participant's ability to save their group's scores
--   hinges on this function + a correctly-keyed round_status row. This pins the
--   gate logic so a regression is caught here, not at the event.
--
-- CASING NOTE (corrects an older assumption)
--   round_status.round_id is a UUID column (verified: baseline declares it
--   `uuid NOT NULL`), NOT text. A uuid column NORMALIZES casing on store, so an id
--   written UPPERCASE (Swift's UUID().uuidString) is stored — and read back via
--   round_id::text — LOWERCASE. The gate is therefore robust to the app's casing
--   on the STORED side; it only requires the parameter to be the canonical
--   lowercase game_id::text, which the RLS policy always supplies (a uuid cast).
--   We pin both facts so neither silently regresses.
--
-- can_access_game is SECURITY DEFINER, so (like test 03) we just set the JWT sub
-- claim auth.uid() reads. Seeded users A (aaaa…), B (bbbb…); C (cccc…) is a
-- synthetic stranger. In-txn, rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

-- B: proper participant, round_status written with the lowercase id.
INSERT INTO public.round_status (round_id, status, user_id, game_format)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'active',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scramble');

-- A: participant whose row was written with an UPPERCASE id STRING. Because
-- round_id is uuid, Postgres normalizes it to lowercase on store.
INSERT INTO public.round_status (round_id, status, user_id, game_format)
VALUES ('EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE', 'active',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Scramble');

-- 1. Properly-keyed participant B can access (write) the game.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT ok(
  public.can_access_game('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'a participant with a round_status row can access the game'
);

-- 2. A stranger with no round_status row cannot.
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT ok(
  NOT public.can_access_game('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'a user with no round_status row cannot access the game'
);

-- 3. UUID NORMALIZATION: A's row was inserted UPPERCASE but stored lowercase, so
--    the gate called with the canonical lowercase game_id still matches. This is
--    why the app's UUID().uuidString casing is harmless for round_status — the
--    column type, not app code, guarantees the match.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  public.can_access_game('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'an UPPERCASE-inserted round_id still matches the lowercase game id (uuid normalizes)'
);

-- 4. The gate compares the PARAMETER literally to round_id::text (lowercase), so a
--    non-canonical UPPERCASE parameter does NOT match. In practice the RLS policy
--    always passes game_id::text (a uuid cast → lowercase), so this never bites;
--    pinned to document the function's contract.
SELECT ok(
  NOT public.can_access_game('EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE'),
  'an UPPERCASE parameter does not match (gate requires canonical lowercase game_id::text)'
);

-- 5. An unknown game id is inaccessible to everyone.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT ok(
  NOT public.can_access_game('99999999-9999-9999-9999-999999999999'),
  'an unknown game id is inaccessible'
);

SELECT * FROM finish();
ROLLBACK;
