-- Fix: drill-leaderboard notifications ("New Friend Leader!" / "New Group
-- Leader!") were sent to ALL friends and group members whenever a user set
-- their best score — even for a PRIVATE drill that nobody else has. Because a
-- user who builds a drill and enters one score is trivially the sole (=top)
-- participant, the "is leader" check passes and everyone got spammed.
--
-- Fix: only notify recipients who actually HAVE the drill:
--   • they saved it       → a coach_drills row with the same title, OR
--   • they have played it → a drill_results row for the same drill_id.
-- This covers custom/shared drills (saved) and built-in drills (played), and
-- leaves a private, unshared drill notifying nobody.
--
-- Also switches the push Authorization header to the Vault service_role_key
-- lookup (matching notify_round_status_change). The baseline migration stores a
-- sanitized placeholder for that key, so we must NOT re-emit it here.

-- Helper: does this recipient have the drill (saved or played)?
CREATE OR REPLACE FUNCTION "public"."notify_recipient_has_drill"(
  "p_user_id" "uuid", "p_drill_title" "text", "p_drill_id" "uuid"
) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_drills cd
    WHERE cd.coach_id = p_user_id AND cd.title = p_drill_title
  ) OR EXISTS (
    SELECT 1 FROM public.drill_results dr
    WHERE dr.user_id = p_user_id AND dr.drill_id = p_drill_id
  );
$$;
ALTER FUNCTION "public"."notify_recipient_has_drill"("uuid", "text", "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_drill_leaderboard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_drill_title text;
  v_user_name text;
  v_is_best boolean;
  v_lower_is_better boolean;
  v_group record;
  v_is_group_leader boolean;
  v_is_friend_leader boolean;
  v_group_notified_user_ids UUID[];
  v_group_member_ids UUID[];
  v_notify_user_id UUID;
  v_notify_title TEXT;
  v_notify_body TEXT;
  _service_role_key TEXT;
BEGIN
  SELECT title, COALESCE(lower_is_better, false)
  INTO v_drill_title, v_lower_is_better
  FROM public.drills
  WHERE id = NEW.drill_id;

  SELECT COALESCE(display_name, username, 'Someone')
  INTO v_user_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  SELECT decrypted_secret INTO _service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_lower_is_better THEN
    SELECT NEW.total_points <= COALESCE(MIN(total_points), NEW.total_points)
    INTO v_is_best
    FROM public.drill_results
    WHERE drill_id = NEW.drill_id AND user_id = NEW.user_id;
  ELSE
    SELECT NEW.total_points >= COALESCE(MAX(total_points), NEW.total_points)
    INTO v_is_best
    FROM public.drill_results
    WHERE drill_id = NEW.drill_id AND user_id = NEW.user_id;
  END IF;

  IF v_is_best THEN
    v_group_notified_user_ids := ARRAY[]::UUID[];

    -- GROUP PRIORITY
    FOR v_group IN
      SELECT gm.group_id, g.name as group_name
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.user_id = NEW.user_id
    LOOP
      IF v_lower_is_better THEN
        SELECT NEW.total_points <= COALESCE(MIN(dr.total_points), NEW.total_points)
        INTO v_is_group_leader
        FROM public.drill_results dr
        JOIN public.group_members gm ON gm.user_id = dr.user_id
        WHERE dr.drill_id = NEW.drill_id
          AND gm.group_id = v_group.group_id
          AND dr.user_id != NEW.user_id;
      ELSE
        SELECT NEW.total_points >= COALESCE(MAX(dr.total_points), NEW.total_points)
        INTO v_is_group_leader
        FROM public.drill_results dr
        JOIN public.group_members gm ON gm.user_id = dr.user_id
        WHERE dr.drill_id = NEW.drill_id
          AND gm.group_id = v_group.group_id
          AND dr.user_id != NEW.user_id;
      END IF;

      IF v_is_group_leader THEN
        -- Only group members who actually have this drill.
        SELECT array_agg(DISTINCT gm.user_id)
        INTO v_group_member_ids
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id
          AND public.notify_recipient_has_drill(gm.user_id, v_drill_title, NEW.drill_id);

        v_notify_title := 'New Group Leader!';
        v_notify_body := v_user_name || ' is now leading ' || v_group.group_name || ' on ' || v_drill_title || ' with ' || NEW.total_points || ' points';

        INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, context_id, group_id)
        SELECT DISTINCT
          gm.user_id,
          'high_score',
          v_notify_title,
          v_notify_body,
          NEW.drill_id,
          NEW.user_id,
          v_group.group_id,
          v_group.group_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id
          AND public.notify_recipient_has_drill(gm.user_id, v_drill_title, NEW.drill_id)
          AND public.should_send_notification(gm.user_id, 'high_score')
          AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = gm.user_id
              AND n.type = 'high_score'
              AND n.related_id = NEW.drill_id
              AND n.related_user_id = NEW.user_id
              AND COALESCE(n.context_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_group.group_id, '00000000-0000-0000-0000-000000000000'::uuid)
          )
        ON CONFLICT DO NOTHING;

        IF _service_role_key IS NOT NULL THEN
          FOR v_notify_user_id IN
            SELECT DISTINCT gm.user_id
            FROM public.group_members gm
            WHERE gm.group_id = v_group.group_id
              AND gm.user_id != NEW.user_id
              AND public.notify_recipient_has_drill(gm.user_id, v_drill_title, NEW.drill_id)
              AND public.should_send_notification(gm.user_id, 'high_score')
          LOOP
            PERFORM net.http_post(
              url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || _service_role_key
              ),
              body := jsonb_build_object(
                'recipient_user_id', v_notify_user_id::text,
                'title', 'OnlyGolf',
                'body', v_notify_body,
                'notification_type', 'high_score_enabled',
                'metadata', jsonb_build_object(
                  'type', 'high_score',
                  'drill_name', v_drill_title,
                  'drill_id', NEW.drill_id::text,
                  'new_holder_name', v_user_name,
                  'new_score', NEW.total_points::text,
                  'group_name', v_group.group_name
                )
              )
            );
          END LOOP;
        END IF;

        IF v_group_member_ids IS NOT NULL THEN
          v_group_notified_user_ids := v_group_notified_user_ids || v_group_member_ids;
        END IF;
      END IF;
    END LOOP;

    -- FRIEND PRIORITY
    IF v_lower_is_better THEN
      SELECT NEW.total_points <= COALESCE(MIN(dr.total_points), NEW.total_points)
      INTO v_is_friend_leader
      FROM public.drill_results dr
      JOIN public.friends_pairs fp ON (fp.a = dr.user_id OR fp.b = dr.user_id)
      WHERE dr.drill_id = NEW.drill_id
        AND dr.user_id != NEW.user_id
        AND (fp.a = NEW.user_id OR fp.b = NEW.user_id);
    ELSE
      SELECT NEW.total_points >= COALESCE(MAX(dr.total_points), NEW.total_points)
      INTO v_is_friend_leader
      FROM public.drill_results dr
      JOIN public.friends_pairs fp ON (fp.a = dr.user_id OR fp.b = dr.user_id)
      WHERE dr.drill_id = NEW.drill_id
        AND dr.user_id != NEW.user_id
        AND (fp.a = NEW.user_id OR fp.b = NEW.user_id);
    END IF;

    IF v_is_friend_leader THEN
      v_notify_title := 'New Friend Leader!';
      v_notify_body := v_user_name || ' is now leading your friends on ' || v_drill_title || ' with ' || NEW.total_points || ' points';

      INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, context_id, group_id)
      SELECT DISTINCT
        CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END,
        'high_score'::text,
        v_notify_title,
        v_notify_body,
        NEW.drill_id,
        NEW.user_id,
        NULL::uuid,
        NULL::uuid
      FROM public.friends_pairs fp
      WHERE (fp.a = NEW.user_id OR fp.b = NEW.user_id)
        AND CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END != ALL(v_group_notified_user_ids)
        AND public.notify_recipient_has_drill(
              CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END, v_drill_title, NEW.drill_id)
        AND public.should_send_notification(
              CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END, 'high_score')
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END
            AND n.type = 'high_score'
            AND n.related_id = NEW.drill_id
            AND n.related_user_id = NEW.user_id
            AND COALESCE(n.context_id, '00000000-0000-0000-0000-000000000000'::uuid) = '00000000-0000-0000-0000-000000000000'::uuid
        )
      ON CONFLICT DO NOTHING;

      IF _service_role_key IS NOT NULL THEN
        FOR v_notify_user_id IN
          SELECT DISTINCT CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END AS fid
          FROM public.friends_pairs fp
          WHERE (fp.a = NEW.user_id OR fp.b = NEW.user_id)
            AND CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END != ALL(v_group_notified_user_ids)
            AND public.notify_recipient_has_drill(
                  CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END, v_drill_title, NEW.drill_id)
            AND public.should_send_notification(
                  CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END, 'high_score')
        LOOP
          PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || _service_role_key
            ),
            body := jsonb_build_object(
              'recipient_user_id', v_notify_user_id::text,
              'title', 'OnlyGolf',
              'body', v_notify_body,
              'notification_type', 'high_score_enabled',
              'metadata', jsonb_build_object(
                'type', 'high_score',
                'drill_name', v_drill_title,
                'drill_id', NEW.drill_id::text,
                'new_holder_name', v_user_name,
                'new_score', NEW.total_points::text
              )
            )
          );
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
