-- =============================================================
-- Group Chat from Messages Compose
-- 1. Add name column to conversations table
-- 2. Create create_group_chat RPC
-- 3. Update conversations_overview to resolve names for
--    non-golf-group group chats
-- =============================================================

-- ---------------------------------------------------------
-- 1. Add name column to conversations
-- ---------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS name TEXT;

-- ---------------------------------------------------------
-- 2. create_group_chat RPC
--    Creates a group conversation (not tied to a golf group),
--    adds all participants (creator + friends), returns the
--    new conversation ID.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_chat(
  p_name TEXT DEFAULT NULL,
  p_participant_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_id UUID := auth.uid();
  v_conv_id UUID;
  v_pid UUID;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF array_length(p_participant_ids, 1) IS NULL OR array_length(p_participant_ids, 1) < 1 THEN
    RAISE EXCEPTION 'At least one participant is required';
  END IF;

  -- Create the conversation
  INSERT INTO public.conversations (type, name)
  VALUES ('group', NULLIF(TRIM(p_name), ''))
  RETURNING id INTO v_conv_id;

  -- Add the creator as participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_my_id);

  -- Add each friend as participant (skip creator if included)
  FOREACH v_pid IN ARRAY p_participant_ids LOOP
    IF v_pid <> v_my_id THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (v_conv_id, v_pid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conv_id;
END;
$$;

-- ---------------------------------------------------------
-- 3. Update conversations_overview
--    For group chats without a golf group (group_id IS NULL),
--    use the conversation name or a comma-separated list of
--    participant display names as fallback.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conversations_overview()
RETURNS TABLE(
  id uuid,
  type text,
  name text,
  group_id uuid,
  other_user_id uuid,
  last_message text,
  last_message_time timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH my_conversations AS (
    SELECT c.id, c.type, c.group_id, c.updated_at, c.name AS conv_name
    FROM public.conversations c
    WHERE EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = c.group_id AND gm.user_id = auth.uid()
    )
  ),
  friend_meta AS (
    SELECT mc.id AS conversation_id,
           cp_other.user_id AS other_user_id
    FROM my_conversations mc
    JOIN public.conversation_participants cp_me
      ON cp_me.conversation_id = mc.id AND cp_me.user_id = auth.uid()
    JOIN public.conversation_participants cp_other
      ON cp_other.conversation_id = mc.id AND cp_other.user_id <> auth.uid()
    WHERE mc.type = 'friend'
  ),
  -- For non-golf group chats, build a participant name list
  group_chat_names AS (
    SELECT mc.id AS conversation_id,
           string_agg(
             COALESCE(p.display_name, p.username, 'Unknown'),
             ', ' ORDER BY p.display_name, p.username
           ) AS participant_names
    FROM my_conversations mc
    JOIN public.conversation_participants cp
      ON cp.conversation_id = mc.id AND cp.user_id <> auth.uid()
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE mc.type = 'group' AND mc.group_id IS NULL
    GROUP BY mc.id
  ),
  last_msg AS (
    SELECT m.conversation_id, m.content, m.created_at,
           ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC) AS rn
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM my_conversations)
      AND m.deleted_at IS NULL
  )
  SELECT
    mc.id,
    mc.type,
    CASE
      WHEN mc.type = 'group' AND mc.group_id IS NOT NULL THEN g.name
      WHEN mc.type = 'group' AND mc.group_id IS NULL THEN COALESCE(mc.conv_name, gcn.participant_names, 'Group Chat')
      ELSE COALESCE(p.display_name, p.username, 'Unknown')
    END AS name,
    mc.group_id,
    fm.other_user_id,
    lm.content AS last_message,
    lm.created_at AS last_message_time,
    mc.updated_at
  FROM my_conversations mc
  LEFT JOIN public.groups g ON g.id = mc.group_id
  LEFT JOIN friend_meta fm ON fm.conversation_id = mc.id
  LEFT JOIN group_chat_names gcn ON gcn.conversation_id = mc.id
  LEFT JOIN public.profiles p ON p.id = fm.other_user_id
  LEFT JOIN last_msg lm ON lm.conversation_id = mc.id AND lm.rn = 1
  ORDER BY mc.updated_at DESC;
$$;
