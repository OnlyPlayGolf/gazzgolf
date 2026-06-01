-- Conversations overview function to properly resolve names
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
    SELECT c.id, c.type, c.group_id, c.updated_at
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
  last_msg AS (
    SELECT m.conversation_id, m.content, m.created_at,
           ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC) AS rn
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM my_conversations)
  )
  SELECT 
    mc.id,
    mc.type,
    CASE 
      WHEN mc.type = 'group' THEN g.name
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
  LEFT JOIN public.profiles p ON p.id = fm.other_user_id
  LEFT JOIN last_msg lm ON lm.conversation_id = mc.id AND lm.rn = 1
  ORDER BY mc.updated_at DESC;
$$;