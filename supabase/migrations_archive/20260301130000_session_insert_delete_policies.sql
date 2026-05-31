-- Add missing SELECT, INSERT, and DELETE policies for group_sessions.
-- Matches the existing UPDATE policy pattern: creator must be owner/admin OR (member AND coach).

-- SELECT: any group member can see sessions for their group
CREATE POLICY "group_sessions_select_member"
ON public.group_sessions
FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

-- INSERT: creator must be owner/admin OR (member AND coach)
CREATE POLICY "group_sessions_insert_coach_or_admin"
ON public.group_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
);

-- DELETE: same permission as insert — only creator with appropriate role
CREATE POLICY "group_sessions_delete_coach_or_admin"
ON public.group_sessions
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND (
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
);
