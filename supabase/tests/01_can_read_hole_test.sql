-- pgTAP: public.can_read_hole(uuid) — the SECURITY DEFINER visibility gate.
--
-- WHY THIS EXISTS (TESTING.md Phase 1 + CLAUDE.md canon)
--   can_read_hole is the function RLS uses to decide who may read a round's holes.
--   Its logic (verified from the live function body, not assumed): return true iff
--     (a) the caller is a participant on the round (row in round_players), OR
--     (b) the caller is an ACCEPTED friend of a participant (either direction).
--   RLS chains like this are a documented source of silently-dropped rows and
--   Realtime events, so the three visibility outcomes are worth pinning.
--
-- Fixtures come from supabase/seed.sql:
--   user A = aaaaaaaa-...-aaaa, user B = bbbbbbbb-...-bbbb, accepted friendship A<->B.
-- We add a round owned by A and a third "stranger" user C (no friendship) inside
-- the test transaction, then check can_read_hole() as A, B, and C.
--
-- auth.uid() reads request.jwt.claim.sub; we set it per-case with set_config.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

-- A round owned by user A. round_players.round_id has an FK to public.rounds
-- (confirmed from the live schema), so the rounds row must exist first.
-- rounds requires: id, user_id, course_name (everything else has defaults).
INSERT INTO public.rounds (id, user_id, course_name)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Course');

INSERT INTO public.round_players (round_id, user_id)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- A third user C with NO friendship to A (the "stranger" case). Created via the
-- normal auth path so the handle_new_user trigger makes the profile.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'authenticated', 'authenticated', 'c@loopd.test',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Test Player C","handicap":"20"}'::jsonb
);

-- Case 1: participant (A) can read their own round.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  public.can_read_hole('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'participant A can read their own round'
);

-- Case 2: accepted friend (B) can read A's round.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT ok(
  public.can_read_hole('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'accepted friend B can read A''s round'
);

-- Case 3: stranger (C) canNOT read A's round.
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SELECT ok(
  NOT public.can_read_hole('dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'stranger C cannot read A''s round'
);

-- Case 4: unknown round id is unreadable even by a real user (no participant row).
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT ok(
  NOT public.can_read_hole('00000000-0000-0000-0000-000000000000'),
  'a round with no participants is unreadable'
);

SELECT * FROM finish();
ROLLBACK;
