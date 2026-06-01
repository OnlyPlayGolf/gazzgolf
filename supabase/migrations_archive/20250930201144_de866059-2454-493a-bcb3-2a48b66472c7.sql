-- Allow group owners to read their own groups immediately after creation
DROP POLICY IF EXISTS "groups_select_members" ON public.groups;

CREATE POLICY "groups_select_owner_or_member"
ON public.groups
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() OR public.is_group_member(auth.uid(), id)
);