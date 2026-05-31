-- pgTAP: public.can_read_game_hole(text) — visibility gate for the multiplayer
-- game formats (Nine Points, Banker).
--
-- WHY THIS EXISTS (TESTING.md Phase 1 + CLAUDE.md canon)
--   Unlike can_read_hole(uuid) (StrokePlay rounds), the game-format scorecards key
--   off per-format tables. can_read_game_hole (verified from the live body) returns
--   true iff, for the game in nine_points_games OR banker_games matching _game_id:
--     (a) the caller is the game's creator, OR
--     (b) the caller is an ACCEPTED friend of the creator.
--   It compares `g.id::text = _game_id` — a TEXT-vs-uuid comparison, which is the
--   exact UUID-casing surface from CLAUDE.md: uuid::text is lowercase, so a
--   game id passed UPPERCASE silently fails to match. We pin both the visibility
--   logic AND that casing hazard (the bug that has dropped rows/Realtime events).
--
-- Fixtures: seeded users A (aaaa…) and B (bbbb…), accepted friendship A<->B.
-- We add an in-test stranger C and one game per format owned by A.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

-- Stranger C (no friendship to A), via the normal auth path so the profile trigger runs.
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

-- A Nine Points game and a Banker game, both created by A. The 10 NOT-NULL
-- columns (no default) must all be supplied; values are deterministic filler.
INSERT INTO public.nine_points_games
  (id, creator_id, course_name, player_count, players, status, current_hole, hole_count, start_hole, selected_holes, game_settings)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Test Course', 1, '[]'::jsonb, 'active', 1, 18, 1, '[]'::jsonb, '{}'::jsonb);

INSERT INTO public.banker_games
  (id, creator_id, course_name, player_count, players, status, current_hole, hole_count, start_hole, selected_holes, game_settings)
VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Test Course', 1, '[]'::jsonb, 'active', 1, 18, 1, '[]'::jsonb, '{}'::jsonb);

-- ---- Nine Points visibility ----
-- 1. Creator A can read their Nine Points game.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  public.can_read_game_hole('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'creator A can read their Nine Points game'
);

-- 2. Accepted friend B can read it.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT ok(
  public.can_read_game_hole('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'accepted friend B can read A''s Nine Points game'
);

-- 3. Stranger C cannot.
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT ok(
  NOT public.can_read_game_hole('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'stranger C cannot read A''s Nine Points game'
);

-- ---- Banker visibility (different table, same rule) ----
-- 4. Creator A can read their Banker game.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  public.can_read_game_hole('ffffffff-ffff-ffff-ffff-ffffffffffff'),
  'creator A can read their Banker game'
);

-- 5. Stranger C cannot read the Banker game either.
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT ok(
  NOT public.can_read_game_hole('ffffffff-ffff-ffff-ffff-ffffffffffff'),
  'stranger C cannot read A''s Banker game'
);

-- 6. CASING HAZARD (CLAUDE.md): the function compares g.id::text (lowercase) to
--    _game_id. Even the creator gets FALSE if the game id is passed UPPERCASE —
--    this is the silent no-match that drops rows/Realtime events when Swift sends
--    an un-lowercased UUID string. Pinning it documents why .lowercased() matters.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  NOT public.can_read_game_hole(upper('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  'an UPPERCASE game id fails to match (the uuid::text casing hazard is real)'
);

SELECT * FROM finish();
ROLLBACK;
