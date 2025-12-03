-- Add is_coach_group column to groups table
ALTER TABLE public.groups ADD COLUMN is_coach_group boolean NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.groups.is_coach_group IS 'When true, the owner is a coach and should be excluded from leaderboards';