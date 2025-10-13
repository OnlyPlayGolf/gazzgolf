-- Fix the favourite_group_leaderboard_for_drill_by_title to use the correct column name (favourite_group_ids is an array)
-- and include the current user in both friends and groups leaderboards

CREATE OR REPLACE FUNCTION public.friends_leaderboard_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  my_friends AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END as friend_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  ),
  friends_and_me AS (
    SELECT friend_id as user_id FROM my_friends
    UNION
    SELECT auth.uid() as user_id
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT user_id FROM friends_and_me)
    GROUP BY dr.user_id, drill_info.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, p.avatar_url, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC;
$function$;

-- Fix the favourite_group_leaderboard_for_drill_by_title to use favourite_group_ids array and include current user
CREATE OR REPLACE FUNCTION public.favourite_group_leaderboard_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  fav AS (
    SELECT UNNEST(favourite_group_ids) as favourite_group_id 
    FROM public.user_settings 
    WHERE user_id = auth.uid()
  ),
  members AS (
    SELECT DISTINCT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id IN (SELECT favourite_group_id FROM fav)
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT user_id FROM members)
    GROUP BY dr.user_id, drill_info.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, p.avatar_url, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC;
$function$;