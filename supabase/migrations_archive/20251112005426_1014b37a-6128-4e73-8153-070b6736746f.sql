-- Update group_level_leaderboard to show actual highest level completed
-- Remove the 10-level requirement for highest level display

CREATE OR REPLACE FUNCTION public.group_level_leaderboard(p_group_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, completed_levels bigint, highest_level integer, category text)
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
  user_stats AS (
    SELECT 
      up.user_id,
      COUNT(DISTINCT up.level_number) as total_completed,
      MAX(up.level_number) as highest_level,
      (
        SELECT category 
        FROM user_progress up2 
        WHERE up2.user_id = up.user_id 
        ORDER BY up2.level_number DESC 
        LIMIT 1
      ) as category
    FROM user_progress up
    GROUP BY up.user_id
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