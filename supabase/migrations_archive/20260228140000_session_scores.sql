-- session_scores: drill scores recorded within a session

CREATE TABLE IF NOT EXISTS public.session_scores (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  session_drill_id uuid        NOT NULL REFERENCES public.session_drills(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_result_id  uuid        REFERENCES public.drill_results(id) ON DELETE SET NULL,
  score_value      int         NOT NULL,
  is_best          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_scores ENABLE ROW LEVEL SECURITY;

-- SELECT: group members can see scores for leaderboards
CREATE POLICY "session_scores_select_member"
ON public.session_scores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_scores.session_id
    AND public.is_group_member(auth.uid(), gs.group_id)
  )
);

-- INSERT: group members can insert their own scores when session is open
CREATE POLICY "session_scores_insert_member"
ON public.session_scores
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_scores.session_id
    AND gs.status = 'open'
    AND public.is_group_member(auth.uid(), gs.group_id)
  )
);

-- UPDATE: users can update is_best on their own scores
CREATE POLICY "session_scores_update_own"
ON public.session_scores
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_session_scores_leaderboard
ON public.session_scores (session_drill_id, is_best, score_value);

CREATE INDEX IF NOT EXISTS idx_session_scores_user
ON public.session_scores (session_id, user_id);
