-- ============================================================================
-- Levels feature: migrate to tier-based putting + short game system.
--
-- DESTRUCTIVE: all existing user level progress is deleted (beta testers
-- restart from zero). Consolidates the two parallel schemas
-- (web's `level_progress`, iOS's `drill_levels` + `user_drill_progress`)
-- into one clean schema.
--
-- New schema:
--   `levels`               — 70 putting drills seeded (Rookie 20, Amateur 20,
--                            Intermediate 20, Pro 10). Supports future
--                            short_game category.
--   `user_level_progress`  — append-only, immutable. Existence of a row = completed.
--
-- Profiles get `recommended_tier` (rookie/amateur/intermediate/pro), backfilled
-- from the existing TEXT `handicap` column with safe parsing.
--
-- Leaderboard RPCs (`friends_level_leaderboard`, `favourite_groups_level_leaderboard`,
-- `group_level_leaderboard`) are rewritten against the new schema. They return
-- per (user_id, category) rows with completed_in_tier / total_completed / total_xp.
-- No qualification gate.
--
-- `delete_own_account` RPC body updated to delete from `user_level_progress`
-- instead of the dropped `level_progress`.
--
-- The web app's bundled levels code will break — accepted (no active users).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop old leaderboard functions first (so DROP TABLE ... CASCADE later
--    can't take down anything we're about to create).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.friends_level_leaderboard() CASCADE;
DROP FUNCTION IF EXISTS public.favourite_groups_level_leaderboard() CASCADE;
DROP FUNCTION IF EXISTS public.group_level_leaderboard(UUID) CASCADE;

-- ----------------------------------------------------------------------------
-- 2. New tables.
-- ----------------------------------------------------------------------------
CREATE TABLE public.levels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL CHECK (category IN ('putting', 'short_game')),
  tier             TEXT NOT NULL CHECK (tier IN ('rookie', 'amateur', 'intermediate', 'pro')),
  level_in_tier    INTEGER NOT NULL CHECK (level_in_tier >= 1),
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  distance         TEXT,
  success_criteria TEXT,
  xp               INTEGER NOT NULL CHECK (xp > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, tier, level_in_tier)
);

CREATE INDEX idx_levels_category_tier ON public.levels (category, tier, level_in_tier);

CREATE TABLE public.user_level_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level_id     UUID NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, level_id)
);

CREATE INDEX idx_user_level_progress_user  ON public.user_level_progress (user_id);
CREATE INDEX idx_user_level_progress_level ON public.user_level_progress (level_id);

-- ----------------------------------------------------------------------------
-- 3. Profiles: add recommended_tier and backfill from handicap.
--    handicap is TEXT, so we parse defensively. Anything non-numeric (including
--    NULL, empty string, "scratch", "+2"-with-trailing-junk) falls through to
--    'rookie' as the safe default.
--    "+2" with no junk does cast to NUMERIC 2 → 'pro' (correct).
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN recommended_tier TEXT
  CHECK (recommended_tier IN ('rookie', 'amateur', 'intermediate', 'pro'));

UPDATE public.profiles
SET recommended_tier = CASE
  WHEN handicap IS NULL OR trim(handicap) = ''                            THEN 'rookie'
  WHEN trim(handicap) !~ '^[+-]?[0-9]+(\.[0-9]+)?$'                       THEN 'rookie'
  WHEN trim(handicap)::NUMERIC >= 36                                       THEN 'rookie'
  WHEN trim(handicap)::NUMERIC >= 20                                       THEN 'amateur'
  WHEN trim(handicap)::NUMERIC >=  5                                       THEN 'intermediate'
  ELSE                                                                          'pro'
END;

-- ----------------------------------------------------------------------------
-- 4. RLS on `levels` — definitions are public to authenticated users.
-- ----------------------------------------------------------------------------
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read levels"
ON public.levels FOR SELECT
TO authenticated
USING (true);
-- No INSERT/UPDATE/DELETE policies. Only seeded by migrations.

-- ----------------------------------------------------------------------------
-- 5. SECURITY DEFINER helper used by the user_level_progress SELECT policy.
--    Wraps the friends/group-co-member check so Realtime can subscribe
--    without RLS chains breaking event delivery.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_user_level_progress(p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    auth.uid() = p_owner_id
    OR EXISTS (
      SELECT 1 FROM public.friends_pairs fp
      WHERE fp.a = LEAST(auth.uid(), p_owner_id)
        AND fp.b = GREATEST(auth.uid(), p_owner_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = p_owner_id
    );
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS on `user_level_progress`.
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_level_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own and friends' level progress"
ON public.user_level_progress FOR SELECT
TO authenticated
USING (public.can_read_user_level_progress(user_id));

CREATE POLICY "Users can insert their own level progress"
ON public.user_level_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own level progress"
ON public.user_level_progress FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
-- No UPDATE policy: progress is immutable.

-- ----------------------------------------------------------------------------
-- 7. Add user_level_progress to the realtime publication so iOS clients can
--    subscribe to insert events. Wrapped in a guard for environments where
--    the publication doesn't exist (e.g. local dev without realtime stack).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_level_progress;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Seed `levels` with the 70 putting drills (Rookie/Amateur/Intermediate/Pro).
--    Source: Loopd_Putting_Levels_Final.xlsx. Short game category will be
--    seeded later — schema supports it but no rows yet.
-- ----------------------------------------------------------------------------
INSERT INTO public.levels (category, tier, level_in_tier, name, description, distance, success_criteria, xp) VALUES
  -- Rookie: 20 rows
  ('putting', 'rookie', 1, 'Short Tap-In', 'Hole a putt from half a meter.', '0.5 m', 'Make 1', 10),
  ('putting', 'rookie', 2, 'Two Tap-Ins', 'Make two short putts in a row from 0.3 m. If you miss, start over.', '0.3 m', '2 in a row', 10),
  ('putting', 'rookie', 3, 'Comfort at 0.5 m', 'Hit four putts from half a meter. You need to make three.', '0.5 m', '3 of 4', 11),
  ('putting', 'rookie', 4, 'Gentle Pace 3 m', 'Roll a putt from 3 m. Get it to stop within half a meter of the hole.', '3 m', 'Within 0.5 m', 11),
  ('putting', 'rookie', 5, 'One-Meter Make', 'One putt from a meter. Make it.', '1 m', 'Make 1', 12),
  ('putting', 'rookie', 6, 'Build at 1 m', 'Two putts from a meter, back to back. Both have to go in.', '1 m', '2 in a row', 12),
  ('putting', 'rookie', 7, 'Short Ladder', 'Make one from 0.5 m, then one from 1 m, then one from 1.5 m. In that order, no misses.', '0.5 / 1 / 1.5 m', 'All 3 in a row', 13),
  ('putting', 'rookie', 8, 'Two from 1 m', 'Make two in a row from a meter.', '1 m', '2 in a row', 13),
  ('putting', 'rookie', 9, 'Opposite Sides at 1 m', 'Stand on one side of the hole, make a 1 m putt. Walk to the other side, make another. Both in a row.', '1 m', '2 in a row', 14),
  ('putting', 'rookie', 10, 'Five Around at 0.5 m', 'Place five balls around the hole, all half a meter out. Hole all five without missing.', '0.5 m', '5 in a row', 14),
  ('putting', 'rookie', 11, 'Four Around at 1 m', 'Four balls around the hole, all a meter out. Make all four.', '1 m', '4 in a row', 15),
  ('putting', 'rookie', 12, 'Two-Putt from 3 m', 'Roll a putt from 3 m and hole it in two strokes or fewer.', '3 m', 'Two-putt or better', 15),
  ('putting', 'rookie', 13, 'Soft Speed 3 m', 'Two putts from 3 m. Each has to stop within half a meter of the hole.', '3 m', 'Both within 0.5 m', 16),
  ('putting', 'rookie', 14, 'Two from 2 m', 'Make two in a row from 2 m.', '2 m', '2 in a row', 16),
  ('putting', 'rookie', 15, 'Mix Makes', 'Make one from 1 m, then one from 1.5 m, then one from 2 m. No misses.', '1 / 1.5 / 2 m', 'All 3 in a row', 17),
  ('putting', 'rookie', 16, 'Five Around at 1 m', 'Five balls around the hole, all a meter out. Hole all five in a row.', '1 m', '5 in a row', 17),
  ('putting', 'rookie', 17, 'Opposite Sides at 2 m', 'Make a 2 m putt from one side, then another from the opposite side. Both in a row.', '2 m', '2 in a row', 18),
  ('putting', 'rookie', 18, 'Ten in a Row at 0.5 m', 'Ten short putts in a row from half a meter. One miss and you start over.', '0.5 m', '10 in a row', 18),
  ('putting', 'rookie', 19, 'Mid Ladder', 'Make one from 0.5 m, then one from 1 m, then one from 2 m. In that order.', '0.5 / 1 / 2 m', 'All 3 in a row', 19),
  ('putting', 'rookie', 20, 'Five Around at 1 m (Final)', 'Five balls around the hole at a meter. All five in a row to finish the tier.', '1 m', '5 in a row', 20),
  -- Amateur: 20 rows
  ('putting', 'amateur', 1, 'Speed 4 m Intro', 'Two putts from 4 m. Both should stop within a meter of the hole.', '4 m', 'Both within 1 m', 25),
  ('putting', 'amateur', 2, 'Make 1 at 3.5 m', 'One putt from 3.5 m. Hole it.', '3.5 m', 'Make 1', 26),
  ('putting', 'amateur', 3, 'Speed 4 m Tighter', 'Two in a row from 4 m, each one stopping within half a meter of the hole.', '4 m', '2 in a row within 0.5 m', 27),
  ('putting', 'amateur', 4, 'Speed Ladder 2–4 m', 'One putt from 2 m, then 3 m, then 4 m. Each one has to stop within a meter past the hole. No misses on speed.', '2 / 3 / 4 m', 'All 3 within 1 m past', 28),
  ('putting', 'amateur', 5, 'Make 1 at 4 m', 'One putt from 4 m. Hole it.', '4 m', 'Make 1', 29),
  ('putting', 'amateur', 6, 'Two-Putt from 10 m', 'Roll a long one from 10 m and finish in two strokes.', '10 m', 'Two-putt or better', 30),
  ('putting', 'amateur', 7, 'Speed 5 m', 'Two in a row from 5 m. Each one makes or stops within a meter past the hole.', '5 m', '2 in a row within 1 m past', 32),
  ('putting', 'amateur', 8, 'Long Speed Ladder', 'One putt from 3 m, then 4 m, then 5 m. Each makes or stops within half a meter past the hole.', '3 / 4 / 5 m', 'All 3 within 0.5 m past', 34),
  ('putting', 'amateur', 9, 'Pressure 2 m', 'Two in a row from 2 m. Miss either one and you restart.', '2 m', '2 in a row', 36),
  ('putting', 'amateur', 10, 'Three-Distance Run', 'Make one from 1 m, one from 2 m, one from 3 m. In that order, no misses.', '1 / 2 / 3 m', 'All 3 in a row', 38),
  ('putting', 'amateur', 11, 'One-Hand at 1 m', 'Three in a row from a meter, putting with one hand only.', '1 m', '3 in a row, one hand', 40),
  ('putting', 'amateur', 12, 'Speed 6 m', 'Three putts from 6 m. Each one stops within a meter past the hole.', '6 m', 'All 3 within 1 m past', 42),
  ('putting', 'amateur', 13, 'Speed 6 m Tighter', 'Four in a row from 6 m, each stopping within a meter of the hole.', '6 m', '4 in a row within 1 m', 44),
  ('putting', 'amateur', 14, 'Long Lag 15 m', 'Hit a putt from 15 m and finish in two strokes.', '15 m', 'Two-putt or better', 45),
  ('putting', 'amateur', 15, 'Tees Around the Hole', 'Place six tees in a circle around the hole, each a meter out. Hole all six in a row.', '1 m', '6 in a row', 46),
  ('putting', 'amateur', 16, 'Eyes Closed', 'Set up a 1 m putt. Close your eyes before you stroke it. Five in a row.', '1 m', '5 in a row, eyes closed', 47),
  ('putting', 'amateur', 17, 'Make 1 at 7 m', 'One putt from 7 m. Hole it.', '7 m', 'Make 1', 48),
  ('putting', 'amateur', 18, 'Credit Card Gate', 'Set up a 1.5 m straight putt. Half a meter in front of the ball, plant two tees a credit-card width apart. Roll five putts through the gate without hitting either tee.', '1.5 m', '5 in a row through gate', 49),
  ('putting', 'amateur', 19, '10 m Two-Putt Twice', 'Two-putt from 10 m. Then do it again. Both rounds in two strokes or fewer.', '10 m', 'Two-putt twice', 50),
  ('putting', 'amateur', 20, 'Hell Drill', 'Place five tees around the hole, all four feet out.
— Make a putt: move that tee one foot back.
— Miss: move it one foot forward.
— Hole one from eight feet: pull that tee out.
Finish when all five tees are at six feet.', '4–8 ft', 'All 5 tees reach 6 ft', 52),
  -- Intermediate: 20 rows
  ('putting', 'intermediate', 1, 'Speed Ladder 5 m', 'Three in a row from 5 m, each stopping within a meter of the hole.', '5 m', '3 in a row within 1 m', 60),
  ('putting', 'intermediate', 2, 'One-Hand 1.5 m', 'One putt from 1.5 m, one hand only. Hole it.', '1.5 m', 'Make 1, one hand', 62),
  ('putting', 'intermediate', 3, 'Three from 2 m', 'Three in a row from 2 m.', '2 m', '3 in a row', 64),
  ('putting', 'intermediate', 4, 'Speed 3 m', 'Three in a row from 3 m. Each makes or stops within half a meter past the hole.', '3 m', '3 in a row within 0.5 m past', 66),
  ('putting', 'intermediate', 5, '1 m Lockdown', 'Five putts from a meter. All five have to go in.', '1 m', '5 of 5', 68),
  ('putting', 'intermediate', 6, 'Speed 4 m Tight', 'Five putts from 4 m. Three of them have to make or stop within 30 cm past the hole.', '4 m', '3 of 5 within 0.3 m past', 70),
  ('putting', 'intermediate', 7, 'Four Around at 1.5 m', 'Four balls around the hole at 1.5 m. All four in a row.', '1.5 m', '4 in a row', 73),
  ('putting', 'intermediate', 8, 'Two from 3 m', 'Two in a row from 3 m.', '3 m', '2 in a row', 76),
  ('putting', 'intermediate', 9, 'Four from 3 m', 'Hole four putts from 3 m. Doesn''t have to be consecutive.', '3 m', '4 makes total', 80),
  ('putting', 'intermediate', 10, 'Three from 2 m (Streak)', 'Three in a row from 2 m. Miss and you restart.', '2 m', '3 in a row', 84),
  ('putting', 'intermediate', 11, 'Ten in a Row at 1 m', 'Ten makes in a row from a meter. One miss and you restart.', '1 m', '10 in a row', 88),
  ('putting', 'intermediate', 12, 'Eyes Closed at 1 m', 'Four in a row from a meter with your eyes closed.', '1 m', '4 in a row, eyes closed', 92),
  ('putting', 'intermediate', 13, 'Three-Distance Pressure', 'Hole a 6 m putt, then a 2 m putt, then a 1 m putt. All in a row, all different breaks.', '1 / 2 / 6 m', '3 in a row, different breaks', 95),
  ('putting', 'intermediate', 14, 'Speed 8 m', 'Three in a row from 8 m, each stopping within a meter of the hole.', '8 m', '3 in a row within 1 m', 98),
  ('putting', 'intermediate', 15, 'Speed 4 m Hard', 'Three putts from 4 m. Each stops within half a meter past the hole.', '4 m', 'All 3 within 0.5 m past', 100),
  ('putting', 'intermediate', 16, 'Six in a Row', 'Place balls at 1 m and 2 m on opposite sides of the hole.
— Start with the 1 m from one side. Hole it.
— Move to the 1 m on the other side. Hole it.
— Same with the 2 m, both sides.
Miss one, start over.', '1 / 2 m', 'All 4 in a row', 102),
  ('putting', 'intermediate', 17, 'One-Hand Five', 'Five in a row from a meter, one hand only.', '1 m', '5 in a row, one hand', 104),
  ('putting', 'intermediate', 18, 'Three from 3 m', 'Three in a row from 3 m.', '3 m', '3 in a row', 106),
  ('putting', 'intermediate', 19, 'Distance Control 1–6 m', 'Place balls at 1, 2, 3, 4, and 5 m on opposite sides of the hole. Target zone is a meter past the hole.
— Start with the 1 m. Hole it, or stop it in the target zone.
— Move to the same distance on the other side. Same rule.
— Work through every distance, both sides.
Miss the target, start over.', '1–5 m', 'Complete all distances', 108),
  ('putting', 'intermediate', 20, 'Final Short Putt Test', 'Twenty putts total, four each from 4, 5, 6, 7, and 8 feet, on four different holes. Make at least fifteen.', '4–8 ft', '15 of 20', 110),
  -- Pro: 10 rows
  ('putting', 'pro', 1, 'Lag Ladder 8–10 m', 'One putt from 8 m, then 9 m, then 10 m. Each stops within a meter of the hole.', '8 / 9 / 10 m', 'All 3 within 1 m', 125),
  ('putting', 'pro', 2, 'Ten in a Row at 1 m', 'Ten makes in a row from a meter.', '1 m', '10 in a row', 130),
  ('putting', 'pro', 3, 'Tight Lag Ladder', 'Same as the loose lag ladder, but the circle around the hole is half a meter.', '8 / 9 / 10 m', 'All 3 within 0.5 m', 140),
  ('putting', 'pro', 4, 'Six in a Row', 'Place balls at 1, 2, and 3 m on opposite sides of the hole.
— Hole the 1 m from one side, then the other side.
— Same with 2 m, both sides.
— Same with 3 m.
Miss one, start over.', '1 / 2 / 3 m', 'All 6 in a row', 150),
  ('putting', 'pro', 5, '8 m Test', 'Nine putts from 8 m, all from different spots. Hole out all nine in seventeen strokes or fewer.', '8 m', '9 holed in ≤17 strokes', 165),
  ('putting', 'pro', 6, 'Long-Range Pressure', 'Hole a 10 m putt, then a 2 m putt, then a 1 m putt. All in a row, all different breaks.', '1 / 2 / 10 m', '3 in a row, different breaks', 180),
  ('putting', 'pro', 7, 'Eyes Closed at 1 m', 'Ten in a row from a meter with your eyes closed.', '1 m', '10 in a row, eyes closed', 200),
  ('putting', 'pro', 8, 'Foot Ladder 1–15 ft', 'Start one foot from the hole.
— Hole it: step back one foot and putt again.
— Miss: start over from one foot.
Reach fifteen feet to finish.', '1–15 ft', 'Reach 15 ft', 220),
  ('putting', 'pro', 9, 'Five-Putt Sequence', 'All in a row:
— Two-putt from 15 m
— Two-putt from 10 m
— Make a 3 m putt
— Make two different 1.5 m putts', '1.5 / 3 / 10 / 15 m', 'Complete in sequence', 235),
  ('putting', 'pro', 10, 'Distance Control 1–6 m (Tight)', 'Place balls at 1, 2, 3, 4, 5, and 6 m on opposite sides of the hole. Target zone is 50 cm past the hole.
— Hole the 1 m, or stop it in the target zone.
— Move to the same distance on the other side. Same rule.
— Work through every distance, both sides.
Miss the target, start over.', '1–6 m', 'Complete all distances', 250);

-- ----------------------------------------------------------------------------
-- 9. Verify seed counts. Fails the transaction if anything is off.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c_total        INTEGER;
  c_rookie       INTEGER;
  c_amateur      INTEGER;
  c_intermediate INTEGER;
  c_pro          INTEGER;
BEGIN
  SELECT COUNT(*) INTO c_total        FROM public.levels WHERE category = 'putting';
  SELECT COUNT(*) INTO c_rookie       FROM public.levels WHERE category = 'putting' AND tier = 'rookie';
  SELECT COUNT(*) INTO c_amateur      FROM public.levels WHERE category = 'putting' AND tier = 'amateur';
  SELECT COUNT(*) INTO c_intermediate FROM public.levels WHERE category = 'putting' AND tier = 'intermediate';
  SELECT COUNT(*) INTO c_pro          FROM public.levels WHERE category = 'putting' AND tier = 'pro';

  IF c_rookie       <> 20 THEN RAISE EXCEPTION 'Expected 20 rookie putting levels, got %', c_rookie; END IF;
  IF c_amateur      <> 20 THEN RAISE EXCEPTION 'Expected 20 amateur putting levels, got %', c_amateur; END IF;
  IF c_intermediate <> 20 THEN RAISE EXCEPTION 'Expected 20 intermediate putting levels, got %', c_intermediate; END IF;
  IF c_pro          <> 10 THEN RAISE EXCEPTION 'Expected 10 pro putting levels, got %', c_pro; END IF;
  IF c_total        <> 70 THEN RAISE EXCEPTION 'Expected 70 total putting levels, got %', c_total; END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. New leaderboard RPCs. Read from the new schema, return per
--     (user_id, category) row. No 10-completion qualification gate.
--
--     completed_in_tier = count of completed levels in the user's highest tier
--                         that has any progress
--     total_completed   = count across all tiers in that category
--     total_xp          = sum of `levels.xp` across all completions in that category
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.friends_level_leaderboard()
RETURNS TABLE(
  user_id           UUID,
  display_name      TEXT,
  username          TEXT,
  avatar_url        TEXT,
  category          TEXT,
  tier              TEXT,
  completed_in_tier INTEGER,
  total_completed   INTEGER,
  total_xp          INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_users AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END AS uid
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
    UNION
    SELECT auth.uid() AS uid
  ),
  per_tier AS (
    SELECT
      ulp.user_id,
      l.category,
      l.tier,
      CASE l.tier
        WHEN 'rookie'       THEN 1
        WHEN 'amateur'      THEN 2
        WHEN 'intermediate' THEN 3
        WHEN 'pro'          THEN 4
      END AS tier_rank,
      COUNT(*)::INT AS completed_count,
      SUM(l.xp)::INT AS xp_sum
    FROM public.user_level_progress ulp
    JOIN public.levels l ON l.id = ulp.level_id
    WHERE ulp.user_id IN (SELECT uid FROM visible_users)
    GROUP BY ulp.user_id, l.category, l.tier
  ),
  highest_tier AS (
    SELECT DISTINCT ON (user_id, category)
      user_id, category, tier, completed_count
    FROM per_tier
    ORDER BY user_id, category, tier_rank DESC
  ),
  category_totals AS (
    SELECT user_id, category,
           SUM(completed_count)::INT AS total_completed,
           SUM(xp_sum)::INT          AS total_xp
    FROM per_tier
    GROUP BY user_id, category
  )
  SELECT
    ht.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ht.category,
    ht.tier,
    ht.completed_count AS completed_in_tier,
    ct.total_completed,
    ct.total_xp
  FROM highest_tier ht
  JOIN category_totals ct ON ct.user_id = ht.user_id AND ct.category = ht.category
  JOIN public.profiles p  ON p.id = ht.user_id
  ORDER BY ct.total_xp DESC NULLS LAST, ct.total_completed DESC, p.username ASC;
$$;

CREATE OR REPLACE FUNCTION public.favourite_groups_level_leaderboard()
RETURNS TABLE(
  user_id           UUID,
  display_name      TEXT,
  username          TEXT,
  avatar_url        TEXT,
  category          TEXT,
  tier              TEXT,
  completed_in_tier INTEGER,
  total_completed   INTEGER,
  total_xp          INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fav_groups AS (
    SELECT unnest(favourite_group_ids) AS group_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
  ),
  visible_users AS (
    SELECT DISTINCT gm.user_id AS uid
    FROM public.group_members gm
    WHERE gm.group_id IN (SELECT group_id FROM fav_groups)
  ),
  per_tier AS (
    SELECT
      ulp.user_id,
      l.category,
      l.tier,
      CASE l.tier
        WHEN 'rookie'       THEN 1
        WHEN 'amateur'      THEN 2
        WHEN 'intermediate' THEN 3
        WHEN 'pro'          THEN 4
      END AS tier_rank,
      COUNT(*)::INT  AS completed_count,
      SUM(l.xp)::INT AS xp_sum
    FROM public.user_level_progress ulp
    JOIN public.levels l ON l.id = ulp.level_id
    WHERE ulp.user_id IN (SELECT uid FROM visible_users)
    GROUP BY ulp.user_id, l.category, l.tier
  ),
  highest_tier AS (
    SELECT DISTINCT ON (user_id, category)
      user_id, category, tier, completed_count
    FROM per_tier
    ORDER BY user_id, category, tier_rank DESC
  ),
  category_totals AS (
    SELECT user_id, category,
           SUM(completed_count)::INT AS total_completed,
           SUM(xp_sum)::INT          AS total_xp
    FROM per_tier
    GROUP BY user_id, category
  )
  SELECT
    ht.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ht.category,
    ht.tier,
    ht.completed_count AS completed_in_tier,
    ct.total_completed,
    ct.total_xp
  FROM highest_tier ht
  JOIN category_totals ct ON ct.user_id = ht.user_id AND ct.category = ht.category
  JOIN public.profiles p  ON p.id = ht.user_id
  ORDER BY ct.total_xp DESC NULLS LAST, ct.total_completed DESC, p.username ASC;
$$;

CREATE OR REPLACE FUNCTION public.group_level_leaderboard(p_group_id UUID)
RETURNS TABLE(
  user_id           UUID,
  display_name      TEXT,
  username          TEXT,
  avatar_url        TEXT,
  category          TEXT,
  tier              TEXT,
  completed_in_tier INTEGER,
  total_completed   INTEGER,
  total_xp          INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_users AS (
    SELECT gm.user_id AS uid
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND public.is_group_member(auth.uid(), p_group_id)
  ),
  per_tier AS (
    SELECT
      ulp.user_id,
      l.category,
      l.tier,
      CASE l.tier
        WHEN 'rookie'       THEN 1
        WHEN 'amateur'      THEN 2
        WHEN 'intermediate' THEN 3
        WHEN 'pro'          THEN 4
      END AS tier_rank,
      COUNT(*)::INT  AS completed_count,
      SUM(l.xp)::INT AS xp_sum
    FROM public.user_level_progress ulp
    JOIN public.levels l ON l.id = ulp.level_id
    WHERE ulp.user_id IN (SELECT uid FROM visible_users)
    GROUP BY ulp.user_id, l.category, l.tier
  ),
  highest_tier AS (
    SELECT DISTINCT ON (user_id, category)
      user_id, category, tier, completed_count
    FROM per_tier
    ORDER BY user_id, category, tier_rank DESC
  ),
  category_totals AS (
    SELECT user_id, category,
           SUM(completed_count)::INT AS total_completed,
           SUM(xp_sum)::INT          AS total_xp
    FROM per_tier
    GROUP BY user_id, category
  )
  SELECT
    ht.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ht.category,
    ht.tier,
    ht.completed_count AS completed_in_tier,
    ct.total_completed,
    ct.total_xp
  FROM highest_tier ht
  JOIN category_totals ct ON ct.user_id = ht.user_id AND ct.category = ht.category
  JOIN public.profiles p  ON p.id = ht.user_id
  ORDER BY ct.total_xp DESC NULLS LAST, ct.total_completed DESC, p.username ASC;
$$;

-- ----------------------------------------------------------------------------
-- 11. Update `delete_own_account` to delete from `user_level_progress`
--     instead of the (about-to-be-dropped) `level_progress` table.
--
--     Body is identical to the 2026-04-17 version (20260417210000) except for
--     the one DELETE line, kept verbatim everywhere else to avoid drift.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Social / feed
  DELETE FROM public.post_comment_replies WHERE user_id = uid;
  DELETE FROM public.post_comment_likes   WHERE user_id = uid;
  DELETE FROM public.post_comments        WHERE user_id = uid;
  DELETE FROM public.post_likes           WHERE user_id = uid;
  DELETE FROM public.posts                WHERE user_id = uid;

  -- Activity feed posts
  DELETE FROM public.activity_posts WHERE user_id = uid;

  -- Round comments
  DELETE FROM public.round_comment_likes   WHERE user_id = uid;
  DELETE FROM public.round_comment_replies WHERE user_id = uid;
  DELETE FROM public.round_comments        WHERE user_id = uid;

  -- Games (user-owned rounds and participation)
  DELETE FROM public.holes         WHERE round_id IN (SELECT id FROM public.rounds WHERE user_id = uid);
  DELETE FROM public.round_players WHERE user_id = uid;
  DELETE FROM public.rounds        WHERE user_id = uid;

  -- Strokes-gained rounds
  DELETE FROM public.sg_rounds WHERE user_id = uid;

  -- Game format tables
  DELETE FROM public.match_play_holes WHERE game_id IN (SELECT id FROM public.match_play_games WHERE user_id = uid);
  DELETE FROM public.match_play_games WHERE user_id = uid;
  DELETE FROM public.best_ball_holes  WHERE game_id IN (SELECT id FROM public.best_ball_games  WHERE user_id = uid);
  DELETE FROM public.best_ball_games  WHERE user_id = uid;
  DELETE FROM public.skins_holes      WHERE game_id IN (SELECT id FROM public.skins_games      WHERE user_id = uid);
  DELETE FROM public.skins_games      WHERE user_id = uid;
  DELETE FROM public.wolf_holes       WHERE game_id IN (SELECT id FROM public.wolf_games       WHERE user_id = uid);
  DELETE FROM public.wolf_games       WHERE user_id = uid;
  DELETE FROM public.scramble_holes   WHERE game_id IN (SELECT id FROM public.scramble_games   WHERE user_id = uid);
  DELETE FROM public.scramble_games   WHERE user_id = uid;
  DELETE FROM public.copenhagen_holes WHERE game_id IN (SELECT id FROM public.copenhagen_games WHERE user_id = uid);
  DELETE FROM public.copenhagen_games WHERE user_id = uid;
  DELETE FROM public.umbriago_holes   WHERE game_id IN (SELECT id FROM public.umbriago_games   WHERE user_id = uid);
  DELETE FROM public.umbriago_games   WHERE user_id = uid;

  -- Pro stats
  DELETE FROM public.pro_stats_holes  WHERE pro_round_id IN (SELECT id FROM public.pro_stats_rounds WHERE user_id = uid);
  DELETE FROM public.pro_stats_rounds WHERE user_id = uid;

  -- Practice / drills / LEVELS (new table)
  DELETE FROM public.drill_results      WHERE user_id = uid;
  DELETE FROM public.user_level_progress WHERE user_id = uid;
  DELETE FROM public.coach_drills       WHERE coach_id = uid;
  DELETE FROM public.coach_ai_feedback  WHERE user_id = uid;

  -- Friends (requester/addressee are uuid columns).
  -- `friends_pairs` is a view over this table — no explicit delete.
  DELETE FROM public.friendships WHERE requester = uid OR addressee = uid;

  -- Notifications & preferences
  DELETE FROM public.notifications            WHERE user_id = uid;
  DELETE FROM public.notification_preferences WHERE user_id = uid;

  -- Notification log
  DELETE FROM public.notification_log WHERE recipient_user_id = uid;

  -- Device tokens for push notifications
  DELETE FROM public.device_tokens WHERE user_id = uid;

  -- Messages
  DELETE FROM public.messages                  WHERE sender_id = uid;
  DELETE FROM public.conversation_participants WHERE user_id = uid;

  -- Conversation-level preferences per user
  DELETE FROM public.user_conversation_settings WHERE user_id = uid;

  -- Groups
  DELETE FROM public.group_activity_likes    WHERE user_id = uid;
  DELETE FROM public.group_activity_comments WHERE user_id = uid;
  DELETE FROM public.group_activity          WHERE user_id = uid;
  DELETE FROM public.group_challenges        WHERE created_by = uid;
  DELETE FROM public.group_invites           WHERE created_by = uid;
  BEGIN DELETE FROM public.session_scores     WHERE user_id = uid;       EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.session_responses  WHERE user_id = uid;       EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.session_attendance WHERE user_id = uid;       EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.session_coaches    WHERE coach_user_id = uid; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Session invites
  DELETE FROM public.session_invites WHERE invited_user_id = uid OR invited_by = uid;

  -- Favourites & misc
  DELETE FROM public.user_favorites          WHERE user_id = uid;
  DELETE FROM public.favorite_courses        WHERE user_id = uid;
  DELETE FROM public.game_likes              WHERE user_id = uid;
  DELETE FROM public.player_game_stats_mode  WHERE user_id = uid;

  -- Profile (must be after all FK references)
  DELETE FROM public.profiles WHERE id = uid;

  -- Finally delete the auth user
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Drop old tables. CASCADE for safety; nothing in the new schema references
--     them. `IF EXISTS` so this is safe if drill_levels / user_drill_progress
--     were never created in this DB (i.e. iOS schema lived only in code).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.level_progress       CASCADE;
DROP TABLE IF EXISTS public.user_drill_progress  CASCADE;
DROP TABLE IF EXISTS public.drill_levels         CASCADE;
