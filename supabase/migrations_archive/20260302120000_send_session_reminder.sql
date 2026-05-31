-- =============================================================
-- Send Session Reminder RPC
-- Inserts in-app notifications for all group members when a
-- coach sends a session reminder. Updates reminder_sent_at.
-- =============================================================

CREATE OR REPLACE FUNCTION public.send_session_reminder(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_group_name TEXT;
  v_member RECORD;
  v_count INTEGER := 0;
  v_caller_id UUID;
  v_formatted_time TEXT;
  v_message TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Get session details
  SELECT * INTO v_session
  FROM public.group_sessions
  WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Get group name
  SELECT name INTO v_group_name
  FROM public.groups
  WHERE id = v_session.group_id;

  -- Format time for display
  v_formatted_time := to_char(
    v_session.start_time AT TIME ZONE 'UTC',
    'Mon DD at HH12:MI AM'
  );

  -- Build message
  v_message := v_session.title || ' — ' || v_formatted_time;
  IF v_session.location IS NOT NULL AND v_session.location != '' THEN
    v_message := v_message || ' at ' || v_session.location;
  END IF;

  -- Insert notifications for all group members (except the sender)
  FOR v_member IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = v_session.group_id
      AND gm.user_id != v_caller_id
  LOOP
    IF public.should_send_notification(v_member.user_id, 'group_activity') THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      SELECT
        v_member.user_id,
        'group_activity',
        'Session Reminder — ' || COALESCE(v_group_name, 'your group'),
        v_message,
        p_session_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_member.user_id
          AND n.type = 'group_activity'
          AND n.related_id = p_session_id
          AND n.title LIKE 'Session Reminder%'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Update reminder_sent_at
  UPDATE public.group_sessions
  SET reminder_sent_at = NOW()
  WHERE id = p_session_id;

  RETURN v_count;
END;
$$;
