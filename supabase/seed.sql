-- Local/CI seed. Runs automatically after `supabase db reset` applies migrations.
-- Deterministic fixtures for backend tests and the XCUITest harness:
--   1. Ölands GK course + 18 holes
--   2. Two stable test users A and B (so multiplayer scenarios have known UUIDs)
--   3. An accepted friendship A <-> B (so friend-visibility RLS paths are exercised)
--
-- Stable, lowercase UUIDs on purpose: the recurring bug class is UPPERCASE UUID
-- strings breaking case-sensitive text comparisons in RLS (e.g.
-- can_read_game_hole does round_id::text = _game_id). Postgres renders uuid::text
-- lowercase, so seeding lowercase keeps fixtures aligned with that invariant.
--
-- Login credentials (local only): a@loopd.test / b@loopd.test, password "password123".
--
-- IMPORTANT (search_path): the squashed baseline ends with
-- `select set_config('search_path', '', false)`, and `supabase db reset` runs
-- each seed statement as its OWN prepared statement — so a bare `SET search_path`
-- does NOT carry across statements. The robust fix is to SCHEMA-QUALIFY every
-- table (public.* / auth.*), which is immune to search_path. crypt()/gen_salt()/
-- gen_random_uuid() are likewise qualified as extensions.* below.
-- ---------------------------------------------------------------------------
-- 1. Ölands GK
--    Seeded as an "importable" course so it appears in the round-setup wizard's
--    course picker. That picker (CreateGameView.sortedCourses) shows ONLY courses
--    that have external_id != nil AND are in the user's get_my_courses() set
--    (played / favorited / imported_by me). We set external_id + external_data
--    here, and below (after user A exists) set imported_by = A so the course is
--    "A's imported course" and therefore selectable. Manual courses (external_id
--    NULL) are intentionally hidden by the app, so a plain seed course can't be
--    picked — hence this shape.
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (name, location, country_code, tee_names, tee_colors,
                            external_id, external_data)
VALUES (
    'Ölands GK',
    'Öland, Sweden',
    'SE',
    '{"white": "54", "yellow": "50", "blue": "46", "red": "42"}'::jsonb,
    '{"white": "white", "yellow": "yellow", "blue": "blue", "red": "red"}'::jsonb,
    'seed-olands-gk',
    '{"city": "Öland"}'::jsonb
)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_course_id uuid;
BEGIN
    SELECT id INTO v_course_id FROM public.courses WHERE name = 'Ölands GK' LIMIT 1;
    IF v_course_id IS NULL THEN
        RAISE NOTICE 'Ölands GK not found — skipping holes';
        RETURN;
    END IF;

    INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, white_distance, yellow_distance, blue_distance, red_distance) VALUES
        (v_course_id, 1,  4, 12, 282, 282, 267, 240),
        (v_course_id, 2,  4, 4,  366, 318, 318, 267),
        (v_course_id, 3,  4, 14, 298, 282, 235, 235),
        (v_course_id, 4,  4, 18, 286, 286, 234, 234),
        (v_course_id, 5,  3, 10, 142, 130, 130, 93),
        (v_course_id, 6,  5, 2,  416, 391, 350, 350),
        (v_course_id, 7,  3, 16, 135, 135, 113, 113),
        (v_course_id, 8,  4, 6,  358, 307, 307, 260),
        (v_course_id, 9,  4, 8,  243, 223, 223, 196),
        (v_course_id, 10, 4, 7,  284, 284, 245, 245),
        (v_course_id, 11, 3, 15, 156, 156, 129, 129),
        (v_course_id, 12, 4, 5,  317, 279, 279, 241),
        (v_course_id, 13, 3, 17, 165, 133, 133, 133),
        (v_course_id, 14, 5, 1,  524, 466, 410, 410),
        (v_course_id, 15, 4, 9,  359, 359, 314, 275),
        (v_course_id, 16, 4, 13, 314, 314, 257, 257),
        (v_course_id, 17, 5, 3,  421, 375, 332, 332),
        (v_course_id, 18, 4, 11, 353, 303, 303, 264)
    ON CONFLICT DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Test users A and B
--    Insert into auth.users; the on_auth_user_created trigger
--    (handle_new_user) auto-creates the matching public.profiles row from
--    raw_user_meta_data, so we do NOT insert profiles directly here.
--    crypt()/gen_salt() come from pgcrypto (Supabase: extensions schema). If a
--    fresh local stack can't resolve them unqualified, use extensions.crypt /
--    extensions.gen_salt.
-- ---------------------------------------------------------------------------
-- NOTE: the token columns (confirmation_token, recovery_token, etc.) MUST be ''
-- not NULL. GoTrue scans them as Go strings and a NULL yields
-- "converting NULL to string is unsupported" -> 500 on every password login.
-- Real Supabase signups set these to ''; a hand-written seed must do the same.
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
) VALUES
    ('00000000-0000-0000-0000-000000000000',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated', 'authenticated', 'a@loopd.test',
     extensions.crypt('password123', extensions.gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Test Player A","handicap":"10"}'::jsonb,
     '', '', '', '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000',
     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated', 'authenticated', 'b@loopd.test',
     extensions.crypt('password123', extensions.gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Test Player B","handicap":"18"}'::jsonb,
     '', '', '', '', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Email/password identities (GoTrue requires an identities row to allow login).
INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
) VALUES
    (extensions.gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"a@loopd.test"}'::jsonb,
     'email', now(), now(), now()),
    (extensions.gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"b@loopd.test"}'::jsonb,
     'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2b. Mark Ölands GK as imported by user A.
--    Done after A exists (imported_by → auth.users). This puts the course in
--    A's get_my_courses() set so it's selectable in the wizard course picker.
-- ---------------------------------------------------------------------------
UPDATE public.courses
   SET imported_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
 WHERE external_id = 'seed-olands-gk';

-- ---------------------------------------------------------------------------
-- 3. Accepted friendship A <-> B
--    can_read_game_hole / friend-visibility policies check
--    friendships(requester, addressee, status='accepted'). user_a/user_b is the
--    sorted-pair dedup column set; A ('aaa...') sorts before B ('bbb...').
-- ---------------------------------------------------------------------------
INSERT INTO public.friendships (requester, addressee, status, user_a, user_b)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       'accepted',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      AND user_b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
