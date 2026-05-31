-- pgTAP: public.can_read_game_hole(text) — visibility gate for multiplayer game
-- formats (Nine Points, Banker, Umbriago, etc.).
--
-- WHY THIS EXISTS (TESTING.md Phase 1 + CLAUDE.md canon)
--   Verified from the live function body: can_read_game_hole keys off
--   public.round_status (NOT the per-format *_games tables), returning true iff
--   for the row(s) where round_status.round_id::text = _game_id:
--     (a) the caller IS that participant (user_id = auth.uid()), OR
--     (b) the caller is an ACCEPTED friend of that participant.
--
--   The comparison is `round_id::text = _game_id`. round_id is uuid → uuid::text
--   is LOWERCASE, so a game id passed UPPERCASE (Swift's UUID().uuidString
--   without .lowercased()) silently fails to match. That is the exact
--   UUID-casing bug class from CLAUDE.md (dropped rows / dropped Realtime
--   events). We pin both the visibility logic AND that casing hazard.
--
-- Fixtures: seeded users A (aaaa…), B (bbbb…), accepted friendship A<->B.
-- We add an in-test stranger C, and a round_status row owned by A.
-- round_status has no FK on round_id, so a standalone uuid is fine.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

-- Stranger C (no friendship to A), via the auth path so the profile trigger runs.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'authenticated', 'authenticated', 'c_game@loopd.test',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Stranger C","handicap":"20"}'::jsonb
);

-- A game "round_status" row owned by A. round_id stored LOWERCASE (as code must).
INSERT INTO public.round_status (round_id, status, user_id, game_format)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'active',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NinePoints');

-- 1. Participant A can read their own game.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  public.can_read_game_hole('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'participant A can read their own game'
);

-- 2. Accepted friend B can read A's game.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT ok(
  public.can_read_game_hole('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'accepted friend B can read A''s game'
);

-- 3. Stranger C cannot.
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT ok(
  NOT public.can_read_game_hole('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'stranger C cannot read A''s game'
);

-- 4. An unknown game id is unreadable even by a real user.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  NOT public.can_read_game_hole('99999999-9999-9999-9999-999999999999'),
  'an unknown game id is unreadable'
);

-- 5. CASING HAZARD (CLAUDE.md): round_id::text is lowercase, so the SAME id in
--    UPPERCASE fails to match — even for participant A. This is the silent
--    no-match that drops rows/Realtime events when a UUID isn't lowercased.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  NOT public.can_read_game_hole(upper('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  'an UPPERCASE game id fails to match (uuid::text casing hazard is real)'
);

SELECT * FROM finish();
ROLLBACK;
