-- Fix round_comment_replies visibility/insert by delegating access checks to round_comments RLS

DROP POLICY IF EXISTS "Users can view replies on accessible comments" ON public.round_comment_replies;
CREATE POLICY "Users can view replies on accessible comments"
ON public.round_comment_replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.round_comments rc
    WHERE rc.id = round_comment_replies.comment_id
  )
);

DROP POLICY IF EXISTS "Users can reply to comments on accessible rounds" ON public.round_comment_replies;
CREATE POLICY "Users can reply to comments on accessible rounds"
ON public.round_comment_replies
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.round_comments rc
    WHERE rc.id = round_comment_replies.comment_id
  )
);