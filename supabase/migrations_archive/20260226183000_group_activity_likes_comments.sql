-- Group activity likes
CREATE TABLE IF NOT EXISTS public.group_activity_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES public.group_activity(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_activity_likes_activity ON public.group_activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_group_activity_likes_user ON public.group_activity_likes(user_id);

ALTER TABLE public.group_activity_likes ENABLE ROW LEVEL SECURITY;

-- Group activity comments
CREATE TABLE IF NOT EXISTS public.group_activity_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES public.group_activity(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_activity_comments_activity ON public.group_activity_comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_group_activity_comments_user ON public.group_activity_comments(user_id);

ALTER TABLE public.group_activity_comments ENABLE ROW LEVEL SECURITY;

-- RLS: Likes - group members can read/insert/delete
CREATE POLICY "Group members can read activity likes"
ON public.group_activity_likes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_activity ga
    JOIN public.group_members gm ON gm.group_id = ga.group_id
    WHERE ga.id = group_activity_likes.activity_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can like group activity"
ON public.group_activity_likes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_activity ga
    JOIN public.group_members gm ON gm.group_id = ga.group_id
    WHERE ga.id = group_activity_likes.activity_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can unlike group activity"
ON public.group_activity_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- RLS: Comments - group members can read/insert, own user can delete
CREATE POLICY "Group members can read activity comments"
ON public.group_activity_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_activity ga
    JOIN public.group_members gm ON gm.group_id = ga.group_id
    WHERE ga.id = group_activity_comments.activity_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can comment on group activity"
ON public.group_activity_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_activity ga
    JOIN public.group_members gm ON gm.group_id = ga.group_id
    WHERE ga.id = group_activity_comments.activity_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own comments"
ON public.group_activity_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);
