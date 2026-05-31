-- =============================================================
-- Challenge Start/End Notifications
-- Sends in-app notifications to group members when a weekly
-- challenge starts or ends. Runs daily via pg_cron.
-- =============================================================

-- 1. Expand the CHECK constraint to allow 'group_activity' type
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('friend_request', 'group_invite', 'high_score', 'message', 'group_activity'));

-- 2. Create the daily notification function
CREATE OR REPLACE FUNCTION public.notify_challenge_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_challenge RECORD;
  v_group_name TEXT;
  v_member RECORD;
BEGIN
  -- ========== CHALLENGES STARTING TODAY ==========
  FOR v_challenge IN
    SELECT *
    FROM public.group_challenges
    WHERE is_active = true
      AND start_date = CURRENT_DATE
  LOOP
    -- Get group name
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = v_challenge.group_id;

    -- Notify all group members
    FOR v_member IN
      SELECT gm.user_id
      FROM public.group_members gm
      WHERE gm.group_id = v_challenge.group_id
    LOOP
      -- Check user notification preferences
      IF public.should_send_notification(v_member.user_id, 'group_activity') THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_id)
        SELECT
          v_member.user_id,
          'group_activity',
          'Challenge Started!',
          v_challenge.title || ' has started in ' || COALESCE(v_group_name, 'your group') || '. Play ' || v_challenge.drill_title || ' before ' || to_char(v_challenge.end_date, 'Mon DD') || '!',
          v_challenge.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = v_member.user_id
            AND n.type = 'group_activity'
            AND n.related_id = v_challenge.id
            AND n.title = 'Challenge Started!'
        );
      END IF;
    END LOOP;
  END LOOP;

  -- ========== CHALLENGES THAT ENDED YESTERDAY ==========
  FOR v_challenge IN
    SELECT *
    FROM public.group_challenges
    WHERE end_date = CURRENT_DATE - 1
  LOOP
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = v_challenge.group_id;

    FOR v_member IN
      SELECT gm.user_id
      FROM public.group_members gm
      WHERE gm.group_id = v_challenge.group_id
    LOOP
      IF public.should_send_notification(v_member.user_id, 'group_activity') THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_id)
        SELECT
          v_member.user_id,
          'group_activity',
          'Challenge Ended',
          v_challenge.title || ' in ' || COALESCE(v_group_name, 'your group') || ' has ended. Check the results!',
          v_challenge.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = v_member.user_id
            AND n.type = 'group_activity'
            AND n.related_id = v_challenge.id
            AND n.title = 'Challenge Ended'
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- 3. Schedule daily at 08:00 UTC via pg_cron
-- NOTE: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- If pg_cron is not yet enabled, enable it first, then run this SELECT:
SELECT cron.schedule(
  'challenge-notifications',
  '0 8 * * *',
  $$SELECT public.notify_challenge_events()$$
);
