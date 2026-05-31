-- ============================================================
-- Phase 1: Coach AI RAG-lite — metadata columns + feedback table
-- ============================================================

-- 1) Add metadata columns to coach_drills
ALTER TABLE public.coach_drills
  ADD COLUMN IF NOT EXISTS focus_area text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS goal_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS upvotes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvotes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- 2) Create coach_ai_feedback table
CREATE TABLE IF NOT EXISTS public.coach_ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_id uuid NOT NULL REFERENCES public.coach_drills(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  reason_tag text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, drill_id)
);

ALTER TABLE public.coach_ai_feedback ENABLE ROW LEVEL SECURITY;

-- 3) RLS policies for coach_ai_feedback
CREATE POLICY "feedback_insert_own"
  ON public.coach_ai_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_select_own"
  ON public.coach_ai_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "feedback_update_own"
  ON public.coach_ai_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4) Indexes for retrieval queries
CREATE INDEX IF NOT EXISTS idx_coach_drills_focus_area
  ON public.coach_drills (focus_area);

CREATE INDEX IF NOT EXISTS idx_coach_drills_votes
  ON public.coach_drills (upvotes, downvotes);

CREATE INDEX IF NOT EXISTS idx_coach_drills_last_used
  ON public.coach_drills (last_used_at);

CREATE INDEX IF NOT EXISTS idx_coach_ai_feedback_drill
  ON public.coach_ai_feedback (drill_id);

CREATE INDEX IF NOT EXISTS idx_coach_ai_feedback_user
  ON public.coach_ai_feedback (user_id);

-- 5) RPC: submit_coach_feedback (upsert + update aggregates)
CREATE OR REPLACE FUNCTION public.submit_coach_feedback(
  p_drill_id uuid,
  p_vote smallint,
  p_reason_tag text DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_old_vote smallint;
BEGIN
  -- Check if user already voted
  SELECT vote INTO v_old_vote
    FROM public.coach_ai_feedback
   WHERE user_id = v_user_id AND drill_id = p_drill_id;

  IF v_old_vote IS NOT NULL THEN
    -- Reverse old vote
    IF v_old_vote = 1 THEN
      UPDATE public.coach_drills SET upvotes = GREATEST(upvotes - 1, 0)
       WHERE id = p_drill_id;
    ELSE
      UPDATE public.coach_drills SET downvotes = GREATEST(downvotes - 1, 0)
       WHERE id = p_drill_id;
    END IF;

    -- Update the feedback row
    UPDATE public.coach_ai_feedback
       SET vote = p_vote,
           reason_tag = p_reason_tag,
           comment = p_comment,
           created_at = now()
     WHERE user_id = v_user_id AND drill_id = p_drill_id;
  ELSE
    -- Insert new feedback
    INSERT INTO public.coach_ai_feedback (user_id, drill_id, vote, reason_tag, comment)
    VALUES (v_user_id, p_drill_id, p_vote, p_reason_tag, p_comment);
  END IF;

  -- Apply new vote
  IF p_vote = 1 THEN
    UPDATE public.coach_drills SET upvotes = upvotes + 1
     WHERE id = p_drill_id;
  ELSE
    UPDATE public.coach_drills SET downvotes = downvotes + 1
     WHERE id = p_drill_id;
  END IF;
END;
$$;

-- 6) RPC: track_coach_drill_used (increment times_used + set last_used_at)
CREATE OR REPLACE FUNCTION public.track_coach_drill_used(p_drill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coach_drills
     SET times_used = times_used + 1,
         last_used_at = now()
   WHERE id = p_drill_id;
END;
$$;

-- 7) RPC: track_coach_drill_completed (increment completion_count)
CREATE OR REPLACE FUNCTION public.track_coach_drill_completed(p_drill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coach_drills
     SET completion_count = completion_count + 1
   WHERE id = p_drill_id;
END;
$$;

-- 8) Backfill focus_area from existing payload for existing drills (mapped values)
UPDATE public.coach_drills
   SET focus_area = CASE payload->>'shot_area'
     WHEN 'putting' THEN 'putting'
     WHEN 'chipping' THEN 'short_game'
     WHEN 'pitching' THEN 'short_game'
     WHEN 'bunker' THEN 'short_game'
     WHEN 'wedges' THEN 'approach'
     WHEN 'driver' THEN 'driving'
     ELSE 'mixed'
   END
 WHERE focus_area IS NULL
   AND payload->>'shot_area' IS NOT NULL;
