-- Create post_comment_likes table for liking comments
CREATE TABLE IF NOT EXISTS public.post_comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Create post_comment_replies table for replying to comments
CREATE TABLE IF NOT EXISTS public.post_comment_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.post_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comment_replies ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_post_comment_likes_comment_id ON public.post_comment_likes(comment_id);
CREATE INDEX idx_post_comment_likes_user_id ON public.post_comment_likes(user_id);
CREATE INDEX idx_post_comment_replies_comment_id ON public.post_comment_replies(comment_id);
CREATE INDEX idx_post_comment_replies_user_id ON public.post_comment_replies(user_id);

-- RLS policies for post_comment_likes
CREATE POLICY "Users can view likes on accessible comments"
  ON public.post_comment_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM post_comments pc
      JOIN posts p ON p.id = pc.post_id
      WHERE pc.id = post_comment_likes.comment_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
          OR (fp.b = auth.uid() AND fp.a = p.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can like comments on accessible posts"
  ON public.post_comment_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM post_comments pc
      JOIN posts p ON p.id = pc.post_id
      WHERE pc.id = post_comment_likes.comment_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
          OR (fp.b = auth.uid() AND fp.a = p.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can unlike their own likes"
  ON public.post_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for post_comment_replies
CREATE POLICY "Users can view replies on accessible comments"
  ON public.post_comment_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM post_comments pc
      JOIN posts p ON p.id = pc.post_id
      WHERE pc.id = post_comment_replies.comment_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
          OR (fp.b = auth.uid() AND fp.a = p.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can reply to comments on accessible posts"
  ON public.post_comment_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM post_comments pc
      JOIN posts p ON p.id = pc.post_id
      WHERE pc.id = post_comment_replies.comment_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = p.user_id)
          OR (fp.b = auth.uid() AND fp.a = p.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can delete their own replies"
  ON public.post_comment_replies FOR DELETE
  USING (auth.uid() = user_id);
