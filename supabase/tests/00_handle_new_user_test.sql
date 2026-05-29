-- pgTAP: the on_auth_user_created trigger (public.handle_new_user) must create a
-- profiles row from auth user metadata. This is our own SECURITY DEFINER logic,
-- not the framework. If profile auto-creation breaks, new signups get no profile
-- and the app shows a blank user, so it is worth a regression test.
--
-- Runs via `supabase test db` (each file executes in a transaction that is rolled
-- back). The auth.users column set mirrors supabase/seed.sql; if a future GoTrue
-- version changes auth.users, update both together.

BEGIN;
SELECT plan(4);

-- Case 1: metadata carries display_name + handicap.
INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'pgtap_meta@loopd.test',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"PgTap Meta","handicap":"7"}'::jsonb,
    now(), now()
);

SELECT is(
    (SELECT display_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
    'PgTap Meta',
    'handle_new_user copies display_name from raw_user_meta_data'
);

SELECT is(
    (SELECT handicap FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
    '7',
    'handle_new_user copies handicap from raw_user_meta_data'
);

SELECT is(
    (SELECT email FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
    'pgtap_meta@loopd.test',
    'handle_new_user copies email onto the profile'
);

-- Case 2: no display_name metadata -> fall back to the email local-part.
INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'fallbackname@loopd.test',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now()
);

SELECT is(
    (SELECT display_name FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222'),
    'fallbackname',
    'handle_new_user falls back to email local-part when no name metadata'
);

SELECT * FROM finish();
ROLLBACK;
