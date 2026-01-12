-- Add stats_mode column to all game tables
-- This enables in-round stats tracking for any game format

-- Match Play
ALTER TABLE public.match_play_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Copenhagen
ALTER TABLE public.copenhagen_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Skins
ALTER TABLE public.skins_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Wolf
ALTER TABLE public.wolf_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Umbriago
ALTER TABLE public.umbriago_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Best Ball
ALTER TABLE public.best_ball_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Scramble
ALTER TABLE public.scramble_games 
ADD COLUMN IF NOT EXISTS stats_mode text DEFAULT 'none' CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));