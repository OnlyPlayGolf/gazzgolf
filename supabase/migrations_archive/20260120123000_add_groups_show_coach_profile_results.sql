-- Add flag to control whether coach results are visible in coach groups
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS show_coach_profile_results boolean NOT NULL DEFAULT false;

