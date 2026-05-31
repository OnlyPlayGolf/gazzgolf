-- Fix infinite recursion in group_members RLS by using security definer functions

-- 1. Create security definer function to check if user is a group member
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
  )
$$;

-- 2. Create security definer function to check if user is group owner/admin
CREATE OR REPLACE FUNCTION public.is_group_owner_or_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- 3. Drop existing problematic policies
DROP POLICY IF EXISTS "group_members_select_member" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_owner_admin" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update_owner_admin" ON public.group_members;

-- 4. Create new policies using security definer functions
CREATE POLICY "group_members_select_safe"
ON public.group_members
FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "group_members_insert_safe"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow inserting yourself if you're owner/admin, or if it's the initial owner insert
  (auth.uid() = user_id AND public.is_group_owner_or_admin(auth.uid(), group_id))
  OR
  -- Allow owner to insert themselves during group creation
  (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.groups WHERE id = group_id AND owner_id = auth.uid()
  ))
);

CREATE POLICY "group_members_update_safe"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_group_owner_or_admin(auth.uid(), group_id))
WITH CHECK (public.is_group_owner_or_admin(auth.uid(), group_id));

CREATE POLICY "group_members_delete_safe"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  -- Owner/admin can delete others, anyone can delete themselves
  public.is_group_owner_or_admin(auth.uid(), group_id)
  OR auth.uid() = user_id
);

-- 5. Ensure groups table has proper policies for creation
DROP POLICY IF EXISTS "groups_owner_write" ON public.groups;

CREATE POLICY "groups_insert_authenticated"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "groups_select_members"
ON public.groups
FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), id));

CREATE POLICY "groups_update_owner"
ON public.groups
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_delete_owner"
ON public.groups
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());