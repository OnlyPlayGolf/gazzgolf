-- Add player 6 support to wolf_games
ALTER TABLE public.wolf_games
ADD COLUMN player_6 text,
ADD COLUMN player_6_points integer NOT NULL DEFAULT 0;

-- Add player 6 support to wolf_holes  
ALTER TABLE public.wolf_holes
ADD COLUMN player_6_score integer,
ADD COLUMN player_6_hole_points integer NOT NULL DEFAULT 0,
ADD COLUMN player_6_running_total integer NOT NULL DEFAULT 0;