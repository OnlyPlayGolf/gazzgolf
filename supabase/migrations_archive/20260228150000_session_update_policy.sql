-- Ensure session creator (coach/admin) can update session fields including status

-- Safely drop any existing update policy on group_sessions
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
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
);
