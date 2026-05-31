-- Add hole_number column to round_comments for hole-specific comments
ALTER TABLE public.round_comments 
ADD COLUMN IF NOT EXISTS hole_number integer;

-- Create round_comment_likes table for liking comments
CREATE TABLE IF NOT EXISTS public.round_comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.round_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Create round_comment_replies table for replying to comments
CREATE TABLE IF NOT EXISTS public.round_comment_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.round_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.round_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_comment_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for round_comment_likes
CREATE POLICY "Users can view likes on accessible comments"
  ON public.round_comment_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM round_comments rc
      WHERE rc.id = round_comment_likes.comment_id
      AND (
        rc.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM rounds r
          WHERE r.id = rc.round_id
          AND (
            r.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM friends_pairs fp
              WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
              OR (fp.b = auth.uid() AND fp.a = r.user_id)
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can like comments on accessible rounds"
  ON public.round_comment_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM round_comments rc
      JOIN rounds r ON r.id = rc.round_id
      WHERE rc.id = round_comment_likes.comment_id
      AND (
        r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
          OR (fp.b = auth.uid() AND fp.a = r.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can unlike their own likes"
  ON public.round_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for round_comment_replies
CREATE POLICY "Users can view replies on accessible comments"
  ON public.round_comment_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM round_comments rc
      WHERE rc.id = round_comment_replies.comment_id
      AND (
        rc.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM rounds r
          WHERE r.id = rc.round_id
          AND (
            r.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM friends_pairs fp
              WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
              OR (fp.b = auth.uid() AND fp.a = r.user_id)
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can reply to comments on accessible rounds"
  ON public.round_comment_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM round_comments rc
      JOIN rounds r ON r.id = rc.round_id
      WHERE rc.id = round_comment_replies.comment_id
      AND (
        r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
          OR (fp.b = auth.uid() AND fp.a = r.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can delete their own replies"
  ON public.round_comment_replies FOR DELETE
  USING (auth.uid() = user_id);