-- =============================================================
-- Allow sessions without a group (friend-only / private sessions)
-- =============================================================

-- 1. Make group_id nullable
ALTER TABLE public.group_sessions ALTER COLUMN group_id DROP NOT NULL;

-- 2. SELECT: creator can see their own sessions where group_id IS NULL
--    (Invited users already covered by is_session_invited in the existing policy)
--    We need to drop and recreate the SELECT policy to add the NULL group case.
DROP POLICY IF EXISTS "group_sessions_select_member" ON public.group_sessions;
DROP POLICY IF EXISTS "session_no_group_creator_select" ON public.group_sessions;

CREATE POLICY "group_sessions_select_member"
ON public.group_sessions
FOR SELECT
TO authenticated
USING (
  -- Original: group member or invited
  (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id))
  OR public.is_session_invited(auth.uid(), id)
  -- New: creator can always see their own no-group sessions
  OR (group_id IS NULL AND created_by = auth.uid())
);

-- 3. INSERT: coaches can create sessions without a group
DROP POLICY IF EXISTS "group_sessions_insert_coach_or_admin" ON public.group_sessions;

CREATE POLICY "group_sessions_insert_coach_or_admin"
ON public.group_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    -- With a group: must be owner/admin or coach member
    (
      group_id IS NOT NULL
      AND (
        public.is_group_owner_or_admin(auth.uid(), group_id)
        OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
      )
    )
    -- Without a group: must be a coach
    OR (group_id IS NULL AND public.is_coach(auth.uid()))
  )
);

-- 4. UPDATE: coaches can update their no-group sessions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'group_sessions' AND schemaname = 'public'
    AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.group_sessions', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "group_sessions_update_creator"
ON public.group_sessions
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  AND (
    (
      group_id IS NOT NULL
      AND (
        public.is_group_owner_or_admin(auth.uid(), group_id)
        OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
      )
    )
    OR (group_id IS NULL AND public.is_coach(auth.uid()))
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    (
      group_id IS NOT NULL
      AND (
        public.is_group_owner_or_admin(auth.uid(), group_id)
        OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
      )
    )
    OR (group_id IS NULL AND public.is_coach(auth.uid()))
  )
);

-- 5. DELETE: coaches can delete their no-group sessions
DROP POLICY IF EXISTS "group_sessions_delete_coach_or_admin" ON public.group_sessions;

CREATE POLICY "group_sessions_delete_coach_or_admin"
ON public.group_sessions
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND (
    (
      group_id IS NOT NULL
      AND (
        public.is_group_owner_or_admin(auth.uid(), group_id)
        OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
      )
    )
    OR (group_id IS NULL AND public.is_coach(auth.uid()))
  )
);

-- 6. Update related table policies to handle NULL group_id sessions
--    session_attendance: allow creator/invited to view attendance on no-group sessions
DROP POLICY IF EXISTS "Group members can view attendance" ON public.session_attendance;

CREATE POLICY "Group members can view attendance"
ON public.session_attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_attendance.session_id
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
      OR public.is_session_invited(auth.uid(), gs.id)
    )
  )
);

-- 7. Update session_invites SELECT policy to handle NULL group_id
DROP POLICY IF EXISTS "session_invites_select" ON public.session_invites;

CREATE POLICY "session_invites_select"
ON public.session_invites
FOR SELECT
TO authenticated
USING (
  invited_user_id = auth.uid()
  OR invited_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_invites.session_id
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
    )
  )
);

-- 8. Update session_responses SELECT/INSERT to handle NULL group_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'session_responses' AND schemaname = 'public'
    AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.session_responses', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "session_responses_select"
ON public.session_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_responses.session_id
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
      OR public.is_session_invited(auth.uid(), gs.id)
    )
  )
);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'session_responses' AND schemaname = 'public'
    AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.session_responses', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "session_responses_insert"
ON public.session_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_responses.session_id
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
      OR public.is_session_invited(auth.uid(), gs.id)
    )
  )
);

-- 9. Update session_drills SELECT to handle NULL group_id
DROP POLICY IF EXISTS "session_drills_select_member" ON public.session_drills;

CREATE POLICY "session_drills_select_member"
ON public.session_drills
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_drills.session_id
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
      OR public.is_session_invited(auth.uid(), gs.id)
    )
  )
);

-- 10. Update session_scores policies to handle NULL group_id
DROP POLICY IF EXISTS "session_scores_select_member" ON public.session_scores;

CREATE POLICY "session_scores_select_member"
ON public.session_scores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_scores.session_id
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
      OR public.is_session_invited(auth.uid(), gs.id)
    )
  )
);

DROP POLICY IF EXISTS "session_scores_insert_member" ON public.session_scores;

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
    AND (
      (gs.group_id IS NOT NULL AND public.is_group_member(auth.uid(), gs.group_id))
      OR (gs.group_id IS NULL AND gs.created_by = auth.uid())
      OR public.is_session_invited(auth.uid(), gs.id)
    )
  )
);
