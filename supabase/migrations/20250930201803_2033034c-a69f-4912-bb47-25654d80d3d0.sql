-- Fix group_members INSERT policy to allow initial owner insert without circular dependency
DROP POLICY IF EXISTS "group_members_insert_safe" ON public.group_members;

CREATE POLICY "group_members_insert_safe"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow owner to insert themselves during group creation (owner_id check on groups table)
  EXISTS (
    SELECT 1 FROM public.groups 
    WHERE id = group_id 
    AND owner_id = auth.uid()
  )
  OR
  -- Allow if user is already owner/admin in the group (for adding other members)
  EXISTS (
    SELECT 1 FROM public.group_members gm_check
    WHERE gm_check.group_id = group_members.group_id
    AND gm_check.user_id = auth.uid()
    AND gm_check.role IN ('owner', 'admin')
  )
);

-- Create group_invites table
CREATE TABLE IF NOT EXISTS public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  max_uses int,
  uses_count int NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false
);

-- Enable RLS on group_invites
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_invites - only owner/admin can manage
CREATE POLICY "group_invites_select_owner_admin"
ON public.group_invites
FOR SELECT
TO authenticated
USING (public.is_group_owner_or_admin(auth.uid(), group_id));

CREATE POLICY "group_invites_insert_owner_admin"
ON public.group_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by 
  AND public.is_group_owner_or_admin(auth.uid(), group_id)
);

CREATE POLICY "group_invites_update_owner_admin"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (public.is_group_owner_or_admin(auth.uid(), group_id))
WITH CHECK (public.is_group_owner_or_admin(auth.uid(), group_id));

CREATE POLICY "group_invites_delete_owner_admin"
ON public.group_invites
FOR DELETE
TO authenticated
USING (public.is_group_owner_or_admin(auth.uid(), group_id));

-- Create security definer function to accept group invites
CREATE OR REPLACE FUNCTION public.accept_group_invite(invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_group record;
  v_user_id uuid;
  v_already_member boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Look up invite
  SELECT * INTO v_invite
  FROM public.group_invites
  WHERE code = invite_code;

  -- Validate invite exists
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite'
    );
  END IF;

  -- Check if revoked
  IF v_invite.revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite has been revoked'
    );
  END IF;

  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND now() > v_invite.expires_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite has expired'
    );
  END IF;

  -- Check max uses
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum uses reached'
    );
  END IF;

  -- Get group info
  SELECT * INTO v_group
  FROM public.groups
  WHERE id = v_invite.group_id;

  IF v_group IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Group not found'
    );
  END IF;

  -- Check if already a member (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_id = v_invite.group_id
    AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'group_id', v_group.id,
      'group_name', v_group.name
    );
  END IF;

  -- Add user to group
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_invite.group_id, v_user_id, 'member');

  -- Increment uses count
  UPDATE public.group_invites
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group.id,
    'group_name', v_group.name,
    'already_member', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;