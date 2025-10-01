-- Create RPC function to get global leaderboard for a drill by title
CREATE OR REPLACE FUNCTION public.global_leaderboard_for_drill(p_drill_title text)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  best_score integer,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH drill_uuid AS (
    SELECT id FROM public.drills WHERE title = p_drill_title LIMIT 1
  ),
  best_scores AS (
    SELECT 
      dr.user_id,
      MAX(dr.total_points) as best_score
    FROM public.drill_results dr, drill_uuid
    WHERE dr.drill_id = drill_uuid.id
    GROUP BY dr.user_id
  ),
  ranked AS (
    SELECT 
      bs.user_id,
      p.display_name,
      p.username,
      bs.best_score,
      RANK() OVER (ORDER BY bs.best_score DESC) as rank
    FROM best_scores bs
    JOIN public.profiles p ON p.id = bs.user_id
  )
  SELECT * FROM ranked
  ORDER BY rank, username;
$$;

-- Update the friends leaderboard function to accept drill title instead of UUID
CREATE OR REPLACE FUNCTION public.top3_friends_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH drill_uuid AS (
    SELECT id FROM public.drills WHERE title = p_drill_title LIMIT 1
  ),
  my_friends AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END as friend_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  ),
  best AS (
    SELECT dr.user_id, MAX(dr.total_points) as best_score
    FROM public.drill_results dr, drill_uuid
    WHERE dr.drill_id = drill_uuid.id
      AND dr.user_id IN (SELECT friend_id FROM my_friends)
    GROUP BY dr.user_id
  )
  SELECT b.user_id, p.display_name, p.username, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  ORDER BY b.best_score DESC, p.username ASC
  LIMIT 3;
$$;

-- Update the group leaderboard function to accept drill title instead of UUID
CREATE OR REPLACE FUNCTION public.top3_favourite_group_for_drill_by_title(p_drill_title text)
RETURNS TABLE(user_id uuid, display_name text, username text, best_score integer)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH drill_uuid AS (
    SELECT id FROM public.drills WHERE title = p_drill_title LIMIT 1
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
    SELECT dr.user_id, MAX(dr.total_points) as best_score
    FROM public.drill_results dr, drill_uuid
    WHERE dr.drill_id = drill_uuid.id
      AND dr.user_id IN (SELECT user_id FROM members)
    GROUP BY dr.user_id
  )
  SELECT b.user_id, p.display_name, p.username, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  ORDER BY b.best_score DESC, p.username ASC
  LIMIT 3;
$$;