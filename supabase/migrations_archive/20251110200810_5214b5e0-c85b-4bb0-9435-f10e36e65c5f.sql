-- Drop the current update policy
DROP POLICY IF EXISTS groups_update_owner_or_admin ON public.groups;

-- Create new update policy that allows any group member to update
CREATE POLICY groups_update_members ON public.groups
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
  )
);