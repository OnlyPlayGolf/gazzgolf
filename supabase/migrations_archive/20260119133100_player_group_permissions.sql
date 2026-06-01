-- Player groups: all members can manage/add/invite,
-- but only owner can remove other members and delete group.

-- Helper: manager means owner/admin OR (player group AND member)
CREATE OR REPLACE FUNCTION public.is_group_manager(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_group_owner_or_admin(_user_id, _group_id)
    OR (
      EXISTS (
        SELECT 1
        FROM public.groups g
        WHERE g.id = _group_id
          AND g.group_type = 'player'
      )
      AND public.is_group_member(_user_id, _group_id)
    );
$$;

-- GROUPS: allow managers to update player groups,
-- but prevent changing owner_id or group_type via RLS.
DROP POLICY IF EXISTS "groups_update_player_manager" ON public.groups;
CREATE POLICY "groups_update_player_manager"
ON public.groups
FOR UPDATE
TO authenticated
USING (
  group_type = 'player'
  AND public.is_group_member(auth.uid(), id)
)
WITH CHECK (
  group_type = 'player'
  AND public.is_group_member(auth.uid(), id)
  AND owner_id = (SELECT g.owner_id FROM public.groups g WHERE g.id = id)
  AND group_type = (SELECT g.group_type FROM public.groups g WHERE g.id = id)
);

-- GROUP_INVITES: allow managers (not just owner/admin) for player groups.
DROP POLICY IF EXISTS "group_invites_select_owner_admin" ON public.group_invites;
DROP POLICY IF EXISTS "group_invites_insert_owner_admin" ON public.group_invites;
DROP POLICY IF EXISTS "group_invites_update_owner_admin" ON public.group_invites;
DROP POLICY IF EXISTS "group_invites_delete_owner_admin" ON public.group_invites;

CREATE POLICY "group_invites_select_manager"
ON public.group_invites
FOR SELECT
TO authenticated
USING (public.is_group_manager(auth.uid(), group_id));

CREATE POLICY "group_invites_insert_manager"
ON public.group_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.is_group_manager(auth.uid(), group_id)
);

CREATE POLICY "group_invites_update_manager"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (public.is_group_manager(auth.uid(), group_id))
WITH CHECK (public.is_group_manager(auth.uid(), group_id));

CREATE POLICY "group_invites_delete_manager"
ON public.group_invites
FOR DELETE
TO authenticated
USING (public.is_group_manager(auth.uid(), group_id));

-- GROUP_MEMBERS: allow managers to add members for player groups.
DROP POLICY IF EXISTS "group_members_insert_safe" ON public.group_members;
CREATE POLICY "group_members_insert_safe"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow owner to insert themselves during group creation (avoids circular dependency)
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id
      AND owner_id = auth.uid()
  )
  OR
  -- Allow managers to add members (owner/admin for coach groups, any member for player groups)
  public.is_group_manager(auth.uid(), group_id)
);

-- GROUP_MEMBERS DELETE:
-- - Everyone can leave (delete their own membership).
-- - Removing OTHER members:
--   - coach groups: owner/admin
--   - player groups: owner only
-- - Never allow non-owner to remove the owner membership row.
DROP POLICY IF EXISTS "group_members_delete_safe" ON public.group_members;
CREATE POLICY "group_members_delete_safe"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  -- Allow self-leave for anyone (including owner; owner UI can still prefer Delete Group)
  auth.uid() = user_id
  OR (
    -- Removing someone else
    auth.uid() <> user_id
    AND role <> 'owner'
    AND (
      (
        (SELECT g.group_type FROM public.groups g WHERE g.id = group_id) = 'coach'
        AND public.is_group_owner_or_admin(auth.uid(), group_id)
      )
      OR
      (
        (SELECT g.group_type FROM public.groups g WHERE g.id = group_id) = 'player'
        AND EXISTS (
          SELECT 1 FROM public.groups g2
          WHERE g2.id = group_id
            AND g2.owner_id = auth.uid()
        )
      )
    )
  )
);

