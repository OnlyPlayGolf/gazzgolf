-- Add rolls_per_team column to umbriago_games table
ALTER TABLE public.umbriago_games 
ADD COLUMN IF NOT EXISTS rolls_per_team integer NOT NULL DEFAULT 1;