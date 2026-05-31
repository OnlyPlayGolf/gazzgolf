-- Update friends_level_leaderboard to include the current user
CREATE OR REPLACE FUNCTION public.friends_level_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, completed_levels bigint, current_level text, current_difficulty text)
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
  progress_summary AS (
    SELECT 
      lp.user_id,
      COUNT(*) FILTER (WHERE lp.completed = true) as completed_levels,
      MAX(lp.level_id) as latest_level
    FROM public.level_progress lp
    WHERE lp.user_id IN (SELECT user_id FROM friends_and_me)
    GROUP BY lp.user_id
  )
  SELECT 
    ps.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ps.completed_levels,
    ps.latest_level as current_level,
    ''::text as current_difficulty
  FROM progress_summary ps
  JOIN public.profiles p ON p.id = ps.user_id
  ORDER BY ps.completed_levels DESC, p.username ASC;
$function$;

-- Update favourite_groups_level_leaderboard to include the current user if they are in any favorite groups
-- The current user is already included if they're a member of their favorite groups, so this ensures they appear
CREATE OR REPLACE FUNCTION public.favourite_groups_level_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, completed_levels bigint, current_level text, current_difficulty text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH fav_groups AS (
    SELECT unnest(favourite_group_ids) as group_id 
    FROM public.user_settings 
    WHERE user_id = auth.uid()
  ),
  members AS (
    SELECT DISTINCT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id IN (SELECT group_id FROM fav_groups)
  ),
  progress_summary AS (
    SELECT 
      lp.user_id,
      COUNT(*) FILTER (WHERE lp.completed = true) as completed_levels,
      MAX(lp.level_id) as latest_level
    FROM public.level_progress lp
    WHERE lp.user_id IN (SELECT user_id FROM members)
    GROUP BY lp.user_id
  )
  SELECT 
    ps.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ps.completed_levels,
    ps.latest_level as current_level,
    ''::text as current_difficulty
  FROM progress_summary ps
  JOIN public.profiles p ON p.id = ps.user_id
  ORDER BY ps.completed_levels DESC, p.username ASC;
$function$;