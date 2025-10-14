-- Create helper to get or create a friend conversation between current user and friend_id
CREATE OR REPLACE FUNCTION public.ensure_friend_conversation(friend_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_id uuid := auth.uid();
  v_conv_id uuid;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF friend_id IS NULL OR friend_id = v_my_id THEN
    RAISE EXCEPTION 'Invalid friend id';
  END IF;

  -- Try to find existing friend conversation with both participants
  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  JOIN public.conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = v_my_id
  JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = friend_id
  WHERE c.type = 'friend'
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    -- Create a new friend conversation
    INSERT INTO public.conversations (type)
    VALUES ('friend')
    RETURNING id INTO v_conv_id;

    -- Add both participants
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_my_id);

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, friend_id);
  END IF;

  RETURN v_conv_id;
END;
$$;

-- Create or fetch a group conversation for the given group
CREATE OR REPLACE FUNCTION public.ensure_group_conversation(p_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_id uuid := auth.uid();
  v_conv_id uuid;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid group id';
  END IF;

  -- Ensure the user is a member of the group
  IF NOT public.is_group_member(v_my_id, p_group_id) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  -- Look for existing conversation
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE type = 'group' AND group_id = p_group_id
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    -- Create new group conversation
    INSERT INTO public.conversations (type, group_id)
    VALUES ('group', p_group_id)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;