-- Add double_enabled column to wolf_games table
ALTER TABLE public.wolf_games ADD COLUMN double_enabled boolean NOT NULL DEFAULT true;