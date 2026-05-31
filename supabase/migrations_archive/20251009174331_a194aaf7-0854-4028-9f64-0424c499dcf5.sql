-- Add lower_is_better field to drills table
ALTER TABLE public.drills 
ADD COLUMN lower_is_better BOOLEAN DEFAULT FALSE;

-- Set Aggressive Putting to prefer lower scores
UPDATE public.drills 
SET lower_is_better = TRUE 
WHERE title = 'Aggressive Putting';

-- Update the friends leaderboard function to handle both sort orders
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
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT friend_id FROM my_friends)
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

-- Update the top 3 friends function
CREATE OR REPLACE FUNCTION public.top3_friends_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
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
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT friend_id FROM my_friends)
    GROUP BY dr.user_id, drill_info.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC
  LIMIT 3;
$function$;

-- Update the favourite group leaderboard function
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
    SELECT favourite_group_id FROM public.user_settings WHERE user_id = auth.uid()
  ),
  members AS (
    SELECT gm.user_id
    FROM public.group_members gm, fav
    WHERE gm.group_id = fav.favourite_group_id
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

-- Update top 3 favourite group function
CREATE OR REPLACE FUNCTION public.top3_favourite_group_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  fav AS (
    SELECT favourite_group_id FROM public.user_settings WHERE user_id = auth.uid()
  ),
  members AS (
    SELECT gm.user_id
    FROM public.group_members gm, fav
    WHERE gm.group_id = fav.favourite_group_id
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
  SELECT b.user_id, p.display_name, p.username, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC
  LIMIT 3;
$function$;

-- Update global leaderboard function
CREATE OR REPLACE FUNCTION public.global_leaderboard_for_drill(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, best_score integer, rank bigint)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  best_scores AS (
    SELECT 
      dr.user_id,
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
    GROUP BY dr.user_id, drill_info.lower_is_better
  ),
  ranked AS (
    SELECT 
      bs.user_id,
      p.display_name,
      p.username,
      bs.best_score,
      RANK() OVER (
        ORDER BY 
          CASE WHEN drill_info.lower_is_better THEN bs.best_score END ASC,
          CASE WHEN NOT drill_info.lower_is_better THEN bs.best_score END DESC
      ) as rank
    FROM best_scores bs
    JOIN public.profiles p ON p.id = bs.user_id
    CROSS JOIN drill_info
  )
  SELECT * FROM ranked
  ORDER BY rank, username;
$function$;