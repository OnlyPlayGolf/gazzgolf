-- Update favourite_group_leaderboard_for_drill_by_title to only include drills completed after group creation
-- This ensures that only drills completed after a group was created are shown in group leaderboards

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
  groups_with_dates AS (
    SELECT g.id as group_id, g.created_at as group_created_at
    FROM public.groups g
    WHERE g.id IN (SELECT favourite_group_id FROM fav)
  ),
  members AS (
    SELECT DISTINCT gm.user_id, gwd.group_created_at
    FROM public.group_members gm
    JOIN groups_with_dates gwd ON gm.group_id = gwd.group_id
    WHERE gm.group_id IN (SELECT favourite_group_id FROM fav)
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr
    CROSS JOIN drill_info
    JOIN members m ON dr.user_id = m.user_id
    WHERE dr.drill_id = drill_info.id
      -- Only include drill results completed after the group was created
      AND dr.created_at >= m.group_created_at
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
