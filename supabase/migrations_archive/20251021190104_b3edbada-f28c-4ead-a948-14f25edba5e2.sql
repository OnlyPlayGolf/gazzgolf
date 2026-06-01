-- Fix friends_level_leaderboard to compute highest per user and add group variant
DROP FUNCTION IF EXISTS public.friends_level_leaderboard();

CREATE OR REPLACE FUNCTION public.friends_level_leaderboard()
RETURNS TABLE(
  user_id uuid, 
  display_name text, 
  username text, 
  avatar_url text, 
  completed_levels bigint, 
  highest_level integer,
  category text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH my_friends AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END as friend_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  ),
  friends_and_me AS (
    SELECT friend_id as user_id FROM my_friends
    UNION
    SELECT auth.uid() as user_id
  ),
  user_progress AS (
    SELECT 
      lp.user_id,
      lp.level_number,
      CASE 
        WHEN lp.level_number <= 100 THEN 'Beginner'
        WHEN lp.level_number <= 200 THEN 'Intermediate'
        WHEN lp.level_number <= 300 THEN 'Amateur'
        ELSE 'Professional'
      END as category
    FROM public.level_progress lp
    WHERE lp.user_id IN (SELECT user_id FROM friends_and_me)
      AND lp.completed = true
      AND lp.level_number IS NOT NULL
  ),
  category_counts AS (
    SELECT 
      user_id,
      category,
      COUNT(*) as count_in_category,
      MAX(level_number) as max_level_in_category
    FROM user_progress
    GROUP BY user_id, category
  ),
  qualified_highest AS (
    SELECT 
      cc.user_id,
      cc.max_level_in_category as highest_level,
      cc.category,
      ROW_NUMBER() OVER (PARTITION BY cc.user_id ORDER BY cc.max_level_in_category DESC) as rn
    FROM category_counts cc
    WHERE cc.count_in_category >= 10
  ),
  user_stats AS (
    SELECT 
      up.user_id,
      COUNT(DISTINCT up.level_number) as total_completed,
      qh.highest_level,
      qh.category
    FROM user_progress up
    LEFT JOIN qualified_highest qh ON qh.user_id = up.user_id AND qh.rn = 1
    GROUP BY up.user_id, qh.highest_level, qh.category
  )
  SELECT 
    us.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    us.total_completed as completed_levels,
    us.highest_level,
    COALESCE(us.category, ''::text) as category
  FROM user_stats us
  JOIN public.profiles p ON p.id = us.user_id
  ORDER BY us.highest_level DESC NULLS LAST, us.total_completed DESC, p.username ASC;
$function$;

-- Create group_level_leaderboard for a specific group
CREATE OR REPLACE FUNCTION public.group_level_leaderboard(p_group_id uuid)
RETURNS TABLE(
  user_id uuid, 
  display_name text, 
  username text, 
  avatar_url text, 
  completed_levels bigint, 
  highest_level integer,
  category text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH members AS (
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND public.is_group_member(auth.uid(), p_group_id)
  ),
  user_progress AS (
    SELECT 
      lp.user_id,
      lp.level_number,
      CASE 
        WHEN lp.level_number <= 100 THEN 'Beginner'
        WHEN lp.level_number <= 200 THEN 'Intermediate'
        WHEN lp.level_number <= 300 THEN 'Amateur'
        ELSE 'Professional'
      END as category
    FROM public.level_progress lp
    WHERE lp.user_id IN (SELECT user_id FROM members)
      AND lp.completed = true
      AND lp.level_number IS NOT NULL
  ),
  category_counts AS (
    SELECT 
      user_id,
      category,
      COUNT(*) as count_in_category,
      MAX(level_number) as max_level_in_category
    FROM user_progress
    GROUP BY user_id, category
  ),
  qualified_highest AS (
    SELECT 
      cc.user_id,
      cc.max_level_in_category as highest_level,
      cc.category,
      ROW_NUMBER() OVER (PARTITION BY cc.user_id ORDER BY cc.max_level_in_category DESC) as rn
    FROM category_counts cc
    WHERE cc.count_in_category >= 10
  ),
  user_stats AS (
    SELECT 
      up.user_id,
      COUNT(DISTINCT up.level_number) as total_completed,
      qh.highest_level,
      qh.category
    FROM user_progress up
    LEFT JOIN qualified_highest qh ON qh.user_id = up.user_id AND qh.rn = 1
    GROUP BY up.user_id, qh.highest_level, qh.category
  )
  SELECT 
    us.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    us.total_completed as completed_levels,
    us.highest_level,
    COALESCE(us.category, ''::text) as category
  FROM user_stats us
  JOIN public.profiles p ON p.id = us.user_id
  ORDER BY us.highest_level DESC NULLS LAST, us.total_completed DESC, p.username ASC;
$function$;