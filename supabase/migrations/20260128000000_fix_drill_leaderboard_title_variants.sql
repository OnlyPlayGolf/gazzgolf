-- Fix drill leaderboard functions to handle multiple title variants
-- This ensures that drill results saved with different title variants (e.g., "PGA Tour 18 Holes" vs "PGA Tour 18-hole")
-- are all included in leaderboards

-- Helper function to get all matching drill IDs for a title (including variants)
CREATE OR REPLACE FUNCTION public.get_drill_ids_by_title(p_drill_title text)
RETURNS TABLE(drill_id uuid, lower_is_better boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Map of canonical titles to their variants
  WITH title_variants AS (
    SELECT 
      CASE 
        -- PGA Tour 18-hole variants
        WHEN p_drill_title IN ('PGA Tour 18-hole', 'PGA Tour 18 Holes', 'PGA Tour 18-hole Test', '18-hole PGA Tour Putting Test') 
        THEN ARRAY['PGA Tour 18-hole', 'PGA Tour 18 Holes', 'PGA Tour 18-hole Test', '18-hole PGA Tour Putting Test']
        -- 9 Windows variants
        WHEN p_drill_title IN ('9 Windows Shot Shape', '9 Windows Shot Shape Test', 'TW''s 9 Windows Test')
        THEN ARRAY['9 Windows Shot Shape', '9 Windows Shot Shape Test', 'TW''s 9 Windows Test']
        -- Aggressive Putting variants
        WHEN p_drill_title IN ('Aggressive Putting', 'Aggressive Putting 4-6m')
        THEN ARRAY['Aggressive Putting', 'Aggressive Putting 4-6m']
        -- Default: just use the provided title
        ELSE ARRAY[p_drill_title]
      END as variants
  )
  SELECT DISTINCT d.id as drill_id, COALESCE(d.lower_is_better, false) as lower_is_better
  FROM public.drills d, title_variants tv
  WHERE d.title = ANY(tv.variants);
$function$;

-- Update friends_leaderboard_for_drill_by_title to handle title variants
CREATE OR REPLACE FUNCTION public.friends_leaderboard_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH drill_ids AS (
    SELECT drill_id, lower_is_better 
    FROM public.get_drill_ids_by_title(p_drill_title)
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
  drill_settings AS (
    SELECT lower_is_better FROM drill_ids LIMIT 1
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN ds.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr
    CROSS JOIN drill_settings ds
    WHERE dr.drill_id IN (SELECT drill_id FROM drill_ids)
      AND dr.user_id IN (SELECT user_id FROM friends_and_me)
    GROUP BY dr.user_id, ds.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, p.avatar_url, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_settings ds
  ORDER BY 
    CASE WHEN ds.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT ds.lower_is_better THEN b.best_score END DESC,
    p.username ASC;
$function$;

-- Update favourite_group_leaderboard_for_drill_by_title to handle title variants
CREATE OR REPLACE FUNCTION public.favourite_group_leaderboard_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH drill_ids AS (
    SELECT drill_id, lower_is_better 
    FROM public.get_drill_ids_by_title(p_drill_title)
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
  drill_settings AS (
    SELECT lower_is_better FROM drill_ids LIMIT 1
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN ds.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr
    CROSS JOIN drill_settings ds
    WHERE dr.drill_id IN (SELECT drill_id FROM drill_ids)
      AND dr.user_id IN (SELECT user_id FROM members)
    GROUP BY dr.user_id, ds.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, p.avatar_url, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_settings ds
  ORDER BY 
    CASE WHEN ds.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT ds.lower_is_better THEN b.best_score END DESC,
    p.username ASC;
$function$;

-- Update global_leaderboard_for_drill to handle title variants
CREATE OR REPLACE FUNCTION public.global_leaderboard_for_drill(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, best_score integer, rank bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH drill_ids AS (
    SELECT drill_id, lower_is_better 
    FROM public.get_drill_ids_by_title(p_drill_title)
  ),
  drill_settings AS (
    SELECT lower_is_better FROM drill_ids LIMIT 1
  ),
  best_scores AS (
    SELECT 
      dr.user_id,
      CASE 
        WHEN ds.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr
    CROSS JOIN drill_settings ds
    WHERE dr.drill_id IN (SELECT drill_id FROM drill_ids)
    GROUP BY dr.user_id, ds.lower_is_better
  ),
  ranked AS (
    SELECT 
      bs.user_id,
      p.display_name,
      p.username,
      bs.best_score,
      RANK() OVER (
        ORDER BY 
          CASE WHEN ds.lower_is_better THEN bs.best_score END ASC,
          CASE WHEN NOT ds.lower_is_better THEN bs.best_score END DESC
      ) as rank
    FROM best_scores bs
    JOIN public.profiles p ON p.id = bs.user_id
    CROSS JOIN drill_settings ds
  )
  SELECT * FROM ranked
  ORDER BY rank, username;
$function$;
