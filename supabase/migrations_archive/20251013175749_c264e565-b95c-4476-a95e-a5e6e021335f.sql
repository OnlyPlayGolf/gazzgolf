-- Create table for level progress
CREATE TABLE public.level_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  level_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, level_id)
);

-- Enable RLS
ALTER TABLE public.level_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own level progress"
ON public.level_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' level progress"
ON public.level_progress
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM friends_pairs fp
    WHERE (fp.a = LEAST(auth.uid(), level_progress.user_id) AND fp.b = GREATEST(auth.uid(), level_progress.user_id))
  ) OR
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm2.group_id = gm1.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = level_progress.user_id
  )
);

CREATE POLICY "Users can insert their own level progress"
ON public.level_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own level progress"
ON public.level_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to get friends' level progress
CREATE OR REPLACE FUNCTION public.friends_level_leaderboard()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  completed_levels bigint,
  current_level text,
  current_difficulty text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_friends AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END as friend_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  ),
  progress_summary AS (
    SELECT 
      lp.user_id,
      COUNT(*) FILTER (WHERE lp.completed = true) as completed_levels,
      MAX(lp.level_id) as latest_level
    FROM public.level_progress lp
    WHERE lp.user_id IN (SELECT friend_id FROM my_friends)
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
$$;

-- Function to get group level leaderboards for all favorited groups
CREATE OR REPLACE FUNCTION public.favourite_groups_level_leaderboard()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  completed_levels bigint,
  current_level text,
  current_difficulty text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;