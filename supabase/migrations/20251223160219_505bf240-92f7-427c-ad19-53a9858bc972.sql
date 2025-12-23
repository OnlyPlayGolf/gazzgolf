-- Add round_name column to all game tables for consistent naming

ALTER TABLE public.copenhagen_games 
ADD COLUMN IF NOT EXISTS round_name text;

ALTER TABLE public.skins_games 
ADD COLUMN IF NOT EXISTS round_name text;

ALTER TABLE public.best_ball_games 
ADD COLUMN IF NOT EXISTS round_name text;

ALTER TABLE public.scramble_games 
ADD COLUMN IF NOT EXISTS round_name text;

ALTER TABLE public.wolf_games 
ADD COLUMN IF NOT EXISTS round_name text;

ALTER TABLE public.umbriago_games 
ADD COLUMN IF NOT EXISTS round_name text;

ALTER TABLE public.match_play_games 
ADD COLUMN IF NOT EXISTS round_name text;