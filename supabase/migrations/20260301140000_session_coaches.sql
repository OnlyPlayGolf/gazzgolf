-- =============================================================
-- Multi-Coach Session Support
-- Allows multiple coaches to be assigned to a session.
-- All session coaches can edit the session and appear on each
-- other's Coach Home tab.
-- =============================================================

-- 1. Junction table: session_coaches
CREATE TABLE IF NOT EXISTS public.session_coaches (
  session_id UUID NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  coach_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, coach_user_id)
);

CREATE INDEX idx_session_coaches_coach ON public.session_coaches(coach_user_id);
CREATE INDEX idx_session_coaches_session ON public.session_coaches(session_id);

ALTER TABLE public.session_coaches ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies for session_coaches

-- SELECT: any group member can see which coaches are assigned
CREATE POLICY "session_coaches_select"
ON public.session_coaches FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_id
    AND public.is_group_member(auth.uid(), gs.group_id)
  )
);

-- INSERT: session creator OR existing session coach can add coaches
-- (the added user must be a coach)
CREATE POLICY "session_coaches_insert"
ON public.session_coaches FOR INSERT
TO authenticated
WITH CHECK (
  public.is_coach(coach_user_id)
  AND EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_id
    AND (
      gs.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.session_coaches sc
        WHERE sc.session_id = session_coaches.session_id
        AND sc.coach_user_id = auth.uid()
      )
    )
  )
);

-- DELETE: session creator OR existing session coach can remove coaches
CREATE POLICY "session_coaches_delete"
ON public.session_coaches FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_id
    AND (
      gs.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.session_coaches sc
        WHERE sc.session_id = session_coaches.session_id
        AND sc.coach_user_id = auth.uid()
      )
    )
  )
);

-- 3. Update session UPDATE policy to allow any session coach to edit
-- Drop all existing UPDATE policies on group_sessions first
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'group_sessions' AND schemaname = 'public'
    AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.group_sessions', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "group_sessions_update_coach"
ON public.group_sessions
FOR UPDATE
TO authenticated
USING (
  (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_coaches sc
      WHERE sc.session_id = id
      AND sc.coach_user_id = auth.uid()
    )
  )
  AND (
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
)
WITH CHECK (
  (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_coaches sc
      WHERE sc.session_id = id
      AND sc.coach_user_id = auth.uid()
    )
  )
  AND (
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
);

-- 4. search_coaches RPC
-- Returns coaches/admins, prioritizing same-club users
CREATE OR REPLACE FUNCTION public.search_coaches(
  q TEXT,
  caller_club TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  home_club TEXT,
  country TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''), 'Coach') AS display_name,
    p.avatar_url,
    p.home_club,
    p.country
  FROM public.profiles p
  WHERE
    auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND p.role IN ('coach', 'admin')
    AND (
      LENGTH(TRIM(COALESCE(q, ''))) < 3
      OR (
        COALESCE(p.username, '') ILIKE '%' || q || '%'
        OR COALESCE(p.display_name, '') ILIKE '%' || q || '%'
        OR COALESCE(p.home_club, '') ILIKE '%' || q || '%'
      )
    )
    -- When query is short/empty, only return same-club coaches
    AND (
      LENGTH(TRIM(COALESCE(q, ''))) >= 3
      OR (
        caller_club IS NOT NULL
        AND LENGTH(TRIM(caller_club)) > 0
        AND COALESCE(p.home_club, '') ILIKE '%' || caller_club || '%'
      )
    )
  ORDER BY
    -- Same club first
    CASE WHEN caller_club IS NOT NULL AND COALESCE(p.home_club, '') ILIKE '%' || caller_club || '%' THEN 0 ELSE 1 END,
    -- Then by name match quality
    CASE
      WHEN COALESCE(p.display_name, '') ILIKE q || '%' THEN 0
      WHEN COALESCE(p.username, '') ILIKE q || '%' THEN 1
      ELSE 2
    END,
    p.display_name ASC NULLS LAST
  LIMIT LEAST(COALESCE(max_results, 15), 25);
$$;

-- 5. Expand notification type constraint to include session_coach
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('friend_request', 'group_invite', 'high_score', 'message', 'group_activity', 'session_coach'));

-- 6. Trigger: notify coach when added to a session
CREATE OR REPLACE FUNCTION public.notify_session_coach_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_adder_name TEXT;
  v_group_name TEXT;
BEGIN
  -- Skip if the coach added themselves (e.g. creator self-insert)
  SELECT gs.*, g.name AS group_name
  INTO v_session
  FROM public.group_sessions gs
  JOIN public.groups g ON g.id = gs.group_id
  WHERE gs.id = NEW.session_id;

  IF v_session IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify if the added coach is the session creator (self-add)
  IF NEW.coach_user_id = v_session.created_by THEN
    RETURN NEW;
  END IF;

  -- Get adder's display name
  SELECT COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''), 'A coach')
  INTO v_adder_name
  FROM public.profiles p
  WHERE p.id = v_session.created_by;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.coach_user_id,
    'session_coach',
    'Added to Session',
    COALESCE(v_adder_name, 'A coach') || ' added you to "' || v_session.title || '" in ' || COALESCE(v_session.group_name, 'a group'),
    NEW.session_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_session_coach_added ON public.session_coaches;
CREATE TRIGGER trigger_notify_session_coach_added
  AFTER INSERT ON public.session_coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_coach_added();

-- 7. Trigger: notify all session coaches when session is updated
CREATE OR REPLACE FUNCTION public.notify_session_coaches_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach RECORD;
  v_group_name TEXT;
  v_changes TEXT[];
BEGIN
  -- Only fire when meaningful fields change
  IF OLD.title IS NOT DISTINCT FROM NEW.title
    AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
    AND OLD.location IS NOT DISTINCT FROM NEW.location
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.description IS NOT DISTINCT FROM NEW.description
  THEN
    RETURN NEW;
  END IF;

  -- Get group name
  SELECT name INTO v_group_name FROM public.groups WHERE id = NEW.group_id;

  -- Build changes description
  v_changes := ARRAY[]::TEXT[];
  IF OLD.title IS DISTINCT FROM NEW.title THEN v_changes := v_changes || 'title'; END IF;
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN v_changes := v_changes || 'time'; END IF;
  IF OLD.location IS DISTINCT FROM NEW.location THEN v_changes := v_changes || 'location'; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN v_changes := v_changes || 'status'; END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN v_changes := v_changes || 'description'; END IF;

  -- Notify each session coach except the user who made the change
  FOR v_coach IN
    SELECT sc.coach_user_id
    FROM public.session_coaches sc
    WHERE sc.session_id = NEW.id
    AND sc.coach_user_id <> auth.uid()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (
      v_coach.coach_user_id,
      'session_coach',
      'Session Updated',
      '"' || NEW.title || '" in ' || COALESCE(v_group_name, 'a group') || ' was updated (' || array_to_string(v_changes, ', ') || ')',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_session_coaches_on_update ON public.group_sessions;
CREATE TRIGGER trigger_notify_session_coaches_on_update
  AFTER UPDATE ON public.group_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_coaches_on_update();
