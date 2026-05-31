-- Add group_id column to notifications for context tracking
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- Create unique constraint to prevent duplicate notifications for the same event
-- Event signature: user_id + type + related_id (drill_id) + related_user_id (leader) + group_id
-- This ensures one notification per user per drill leader change, with group context taking priority
-- Note: Using a unique index (not constraint) because we need COALESCE for NULL group_id handling
DROP INDEX IF EXISTS idx_notifications_drill_leader_unique;
CREATE UNIQUE INDEX idx_notifications_drill_leader_unique
  ON public.notifications(user_id, type, related_id, related_user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE type = 'high_score' AND related_id IS NOT NULL AND related_user_id IS NOT NULL;

-- Recreate the notification function with deduplication logic
-- Priority: Group > Friend > Global
CREATE OR REPLACE FUNCTION public.notify_drill_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
BEGIN
  -- Get drill info
  SELECT title, COALESCE(lower_is_better, false)
  INTO v_drill_title, v_lower_is_better
  FROM public.drills
  WHERE id = NEW.drill_id;

  -- Get user display name
  SELECT COALESCE(display_name, username, 'Someone')
  INTO v_user_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Check if this is the user's best score
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

  -- Only proceed if this is their best score
  IF v_is_best THEN
    -- Track which users received group notifications (highest priority)
    v_group_notified_user_ids := ARRAY[]::UUID[];

    -- Check each group the user is in (GROUP PRIORITY)
    FOR v_group IN 
      SELECT gm.group_id, g.name as group_name
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.user_id = NEW.user_id
    LOOP
      -- Check if this score makes them the group leader
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

      -- Notify group members if they're the leader (GROUP PRIORITY)
      IF v_is_group_leader THEN
        -- Get all group member IDs for this group (excluding the leader)
        SELECT array_agg(gm.user_id)
        INTO v_group_member_ids
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id;

        -- Insert notifications for group members (skip if already exists for this event)
        INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, group_id)
        SELECT 
          gm.user_id,
          'high_score',
          'New Group Leader!',
          v_user_name || ' is now leading ' || v_group.group_name || ' on ' || v_drill_title || ' with ' || NEW.total_points || ' points',
          NEW.drill_id,
          NEW.user_id,
          v_group.group_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id
          -- Deduplication: skip if notification already exists for this event
          AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = gm.user_id
              AND n.type = 'high_score'
              AND n.related_id = NEW.drill_id
              AND n.related_user_id = NEW.user_id
              AND COALESCE(n.group_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_group.group_id, '00000000-0000-0000-0000-000000000000'::uuid)
          );

        -- Accumulate users who got group notifications (across all groups)
        IF v_group_member_ids IS NOT NULL THEN
          v_group_notified_user_ids := v_group_notified_user_ids || v_group_member_ids;
        END IF;
      END IF;
    END LOOP;

    -- Check if they're the leader among friends (FRIEND PRIORITY - only if not already notified via group)
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

    -- Notify friends if they're the leader (FRIEND PRIORITY - skip users who already got group notification)
    IF v_is_friend_leader THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, group_id)
      SELECT 
        CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END,
        'high_score',
        'New Friend Leader!',
        v_user_name || ' is now leading your friends on ' || v_drill_title || ' with ' || NEW.total_points || ' points',
        NEW.drill_id,
        NEW.user_id,
        NULL
      FROM public.friends_pairs fp
      WHERE (fp.a = NEW.user_id OR fp.b = NEW.user_id)
        -- Skip users who already received a group notification (deduplication)
        AND CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END != ALL(v_group_notified_user_ids)
        -- Deduplication: skip if notification already exists for this event
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END
            AND n.type = 'high_score'
            AND n.related_id = NEW.drill_id
            AND n.related_user_id = NEW.user_id
            AND COALESCE(n.group_id, '00000000-0000-0000-0000-000000000000'::uuid) = '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Optional: Clean up existing duplicate notifications (keeps the group one if both exist)
-- This is safe to run multiple times
WITH duplicates AS (
  SELECT 
    id,
    user_id,
    related_id,
    related_user_id,
    group_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, related_id, related_user_id 
      ORDER BY 
        CASE WHEN group_id IS NOT NULL THEN 1 ELSE 2 END, -- Group priority
        created_at DESC
    ) as rn
  FROM public.notifications
  WHERE type = 'high_score'
    AND related_id IS NOT NULL
    AND related_user_id IS NOT NULL
)
DELETE FROM public.notifications
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
