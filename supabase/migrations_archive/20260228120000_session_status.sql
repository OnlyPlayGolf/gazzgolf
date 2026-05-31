-- Add status lifecycle to group_sessions

ALTER TABLE public.group_sessions
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';

-- Add CHECK constraint
ALTER TABLE public.group_sessions
DROP CONSTRAINT IF EXISTS group_sessions_status_check;

ALTER TABLE public.group_sessions
ADD CONSTRAINT group_sessions_status_check
CHECK (status IN ('draft', 'scheduled', 'open', 'closed', 'completed'));

-- Backfill existing sessions: past → completed, future → scheduled
UPDATE public.group_sessions
SET status = CASE
  WHEN start_time::timestamptz < now() THEN 'completed'
  ELSE 'scheduled'
END
WHERE status = 'scheduled';

-- Indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_group_sessions_group_status
ON public.group_sessions (group_id, status);
