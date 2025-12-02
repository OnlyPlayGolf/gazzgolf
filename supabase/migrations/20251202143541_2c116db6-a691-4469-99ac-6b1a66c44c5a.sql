-- Enable RLS on post_likes and post_comments if not already enabled
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "post_likes_select_policy" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_policy" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_policy" ON public.post_likes;
DROP POLICY IF EXISTS "post_comments_select_policy" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_policy" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_policy" ON public.post_comments;

-- Post Likes: Users can see likes on posts they can view
CREATE POLICY "post_likes_select_policy" ON public.post_likes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_likes.post_id
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friends_pairs fp
        WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
        OR (fp.b = auth.uid() AND fp.a = p.user_id)
      )
    )
  )
);

-- Post Likes: Users can like posts they can view
CREATE POLICY "post_likes_insert_policy" ON public.post_likes
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_likes.post_id
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friends_pairs fp
        WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
        OR (fp.b = auth.uid() AND fp.a = p.user_id)
      )
    )
  )
);

-- Post Likes: Users can remove their own likes
CREATE POLICY "post_likes_delete_policy" ON public.post_likes
FOR DELETE USING (auth.uid() = user_id);

-- Post Comments: Users can see comments on posts they can view
CREATE POLICY "post_comments_select_policy" ON public.post_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friends_pairs fp
        WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
        OR (fp.b = auth.uid() AND fp.a = p.user_id)
      )
    )
  )
);

-- Post Comments: Users can comment on posts they can view
CREATE POLICY "post_comments_insert_policy" ON public.post_comments
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friends_pairs fp
        WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
        OR (fp.b = auth.uid() AND fp.a = p.user_id)
      )
    )
  )
);

-- Post Comments: Users can delete their own comments
CREATE POLICY "post_comments_delete_policy" ON public.post_comments
FOR DELETE USING (auth.uid() = user_id);