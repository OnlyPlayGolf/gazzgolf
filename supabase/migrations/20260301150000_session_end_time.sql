-- Add end_time column to group_sessions
ALTER TABLE group_sessions
ADD COLUMN end_time TIMESTAMPTZ;
