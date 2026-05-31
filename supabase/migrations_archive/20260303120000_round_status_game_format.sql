-- Add user_id, course_name, and game_format to round_status
-- so all game formats (not just stroke play) can track active/completed state
-- and FriendsOnCourse can query round_status directly without joining game-specific tables.

ALTER TABLE round_status
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS course_name TEXT,
  ADD COLUMN IF NOT EXISTS game_format TEXT NOT NULL DEFAULT 'stroke_play';

-- Backfill existing stroke play rows with user_id and course_name from the rounds table
UPDATE round_status rs
SET user_id = r.user_id::UUID,
    course_name = r.course_name
FROM rounds r
WHERE rs.round_id = r.id
  AND rs.user_id IS NULL;

-- Enable RLS-friendly querying: index on user_id for friend lookups
CREATE INDEX IF NOT EXISTS idx_round_status_user_id ON round_status(user_id);
CREATE INDEX IF NOT EXISTS idx_round_status_game_format ON round_status(game_format);
