-- Add action_url and metadata columns to notifications for deep linking and rich content
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Global toggle
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Per-type preferences (in-app notifications)
  friend_request_enabled BOOLEAN NOT NULL DEFAULT true,
  group_invite_enabled BOOLEAN NOT NULL DEFAULT true,
  high_score_enabled BOOLEAN NOT NULL DEFAULT true,
  message_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Additional notification types
  round_completed_enabled BOOLEAN NOT NULL DEFAULT true,
  achievement_unlocked_enabled BOOLEAN NOT NULL DEFAULT true,
  group_activity_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Quiet hours (24-hour format, e.g., 22:00 to 08:00)
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Auto-cleanup settings (days)
  auto_delete_read_after_days INTEGER DEFAULT 30,
  auto_delete_unread_after_days INTEGER DEFAULT 90,
  -- Created/updated timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to get or create default preferences for a user
CREATE OR REPLACE FUNCTION public.get_notification_preferences(_user_id UUID)
RETURNS TABLE (
  enabled BOOLEAN,
  friend_request_enabled BOOLEAN,
  group_invite_enabled BOOLEAN,
  high_score_enabled BOOLEAN,
  message_enabled BOOLEAN,
  round_completed_enabled BOOLEAN,
  achievement_unlocked_enabled BOOLEAN,
  group_activity_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_enabled BOOLEAN,
  auto_delete_read_after_days INTEGER,
  auto_delete_unread_after_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs RECORD;
BEGIN
  -- Get existing preferences or return defaults
  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id = _user_id;

  IF prefs IS NULL THEN
    -- Return defaults
    RETURN QUERY SELECT
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      NULL::TIME,
      NULL::TIME,
      false::BOOLEAN,
      30::INTEGER,
      90::INTEGER;
  ELSE
    RETURN QUERY SELECT
      prefs.enabled,
      prefs.friend_request_enabled,
      prefs.group_invite_enabled,
      prefs.high_score_enabled,
      prefs.message_enabled,
      prefs.round_completed_enabled,
      prefs.achievement_unlocked_enabled,
      prefs.group_activity_enabled,
      prefs.quiet_hours_start,
      prefs.quiet_hours_end,
      prefs.quiet_hours_enabled,
      prefs.auto_delete_read_after_days,
      prefs.auto_delete_unread_after_days;
  END IF;
END;
$$;

-- Create function to check if notification should be sent based on preferences
CREATE OR REPLACE FUNCTION public.should_send_notification(
  _user_id UUID,
  _type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs RECORD;
  v_current_time TIME;
  in_quiet_hours BOOLEAN := false;
BEGIN
  -- Get user preferences
  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id = _user_id;

  -- If no preferences exist, allow notification (default enabled)
  IF prefs IS NULL THEN
    RETURN true;
  END IF;

  -- Check global toggle
  IF NOT prefs.enabled THEN
    RETURN false;
  END IF;

  -- Check quiet hours
  IF prefs.quiet_hours_enabled AND prefs.quiet_hours_start IS NOT NULL AND prefs.quiet_hours_end IS NOT NULL THEN
    v_current_time := CURRENT_TIME;
    
    -- Handle quiet hours that span midnight (e.g., 22:00 to 08:00)
    IF prefs.quiet_hours_start > prefs.quiet_hours_end THEN
      -- Spanning midnight
      in_quiet_hours := v_current_time >= prefs.quiet_hours_start OR v_current_time <= prefs.quiet_hours_end;
    ELSE
      -- Same day
      in_quiet_hours := v_current_time >= prefs.quiet_hours_start AND v_current_time <= prefs.quiet_hours_end;
    END IF;

    IF in_quiet_hours THEN
      RETURN false;
    END IF;
  END IF;

  -- Check per-type preference
  CASE _type
    WHEN 'friend_request' THEN
      RETURN prefs.friend_request_enabled;
    WHEN 'group_invite' THEN
      RETURN prefs.group_invite_enabled;
    WHEN 'high_score' THEN
      RETURN prefs.high_score_enabled;
    WHEN 'message' THEN
      RETURN prefs.message_enabled;
    WHEN 'round_completed' THEN
      RETURN prefs.round_completed_enabled;
    WHEN 'achievement_unlocked' THEN
      RETURN prefs.achievement_unlocked_enabled;
    WHEN 'group_activity' THEN
      RETURN prefs.group_activity_enabled;
    ELSE
      RETURN true; -- Default to enabled for unknown types
  END CASE;
END;
$$;

-- Update notification triggers to check preferences
-- Note: This requires updating existing trigger functions to call should_send_notification()
-- For now, we'll create a wrapper function that can be used in future notification creation

-- Create index for notification preferences lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
  ON public.notification_preferences(user_id);

-- Create index for notifications action_url (for deep linking)
CREATE INDEX IF NOT EXISTS idx_notifications_action_url 
  ON public.notifications(action_url) 
  WHERE action_url IS NOT NULL;

-- Create index for notifications metadata (for filtering/grouping)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata 
  ON public.notifications USING GIN(metadata);

-- Create function to auto-cleanup old notifications based on preferences
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  prefs RECORD;
BEGIN
  -- Process each user's preferences
  FOR prefs IN 
    SELECT user_id, auto_delete_read_after_days, auto_delete_unread_after_days
    FROM public.notification_preferences
    WHERE auto_delete_read_after_days IS NOT NULL 
       OR auto_delete_unread_after_days IS NOT NULL
  LOOP
    -- Delete read notifications older than threshold
    IF prefs.auto_delete_read_after_days IS NOT NULL THEN
      WITH deleted AS (
        DELETE FROM public.notifications
        WHERE user_id = prefs.user_id
          AND is_read = true
          AND created_at < NOW() - (prefs.auto_delete_read_after_days || ' days')::INTERVAL
        RETURNING id
      )
      SELECT COUNT(*) INTO deleted_count FROM deleted;
    END IF;

    -- Delete unread notifications older than threshold
    IF prefs.auto_delete_unread_after_days IS NOT NULL THEN
      WITH deleted AS (
        DELETE FROM public.notifications
        WHERE user_id = prefs.user_id
          AND is_read = false
          AND created_at < NOW() - (prefs.auto_delete_unread_after_days || ' days')::INTERVAL
        RETURNING id
      )
      SELECT COUNT(*) INTO deleted_count FROM deleted;
    END IF;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();
