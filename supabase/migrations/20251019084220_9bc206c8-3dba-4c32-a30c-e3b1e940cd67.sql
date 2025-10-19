-- Function to notify group members and friends of new drill leaderboard position
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
    -- Check each group the user is in
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

      -- Notify group members if they're the leader
      IF v_is_group_leader THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id)
        SELECT 
          gm.user_id,
          'high_score',
          'New Group Leader!',
          v_user_name || ' is now leading ' || v_group.group_name || ' on ' || v_drill_title || ' with ' || NEW.total_points || ' points',
          NEW.drill_id,
          NEW.user_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id;
      END IF;
    END LOOP;

    -- Check if they're the leader among friends
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

    -- Notify friends if they're the leader
    IF v_is_friend_leader THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id)
      SELECT 
        CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END,
        'high_score',
        'New Friend Leader!',
        v_user_name || ' is now leading your friends on ' || v_drill_title || ' with ' || NEW.total_points || ' points',
        NEW.drill_id,
        NEW.user_id
      FROM public.friends_pairs fp
      WHERE fp.a = NEW.user_id OR fp.b = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for drill results
DROP TRIGGER IF EXISTS on_drill_result_leaderboard ON public.drill_results;
CREATE TRIGGER on_drill_result_leaderboard
  AFTER INSERT ON public.drill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_drill_leaderboard();