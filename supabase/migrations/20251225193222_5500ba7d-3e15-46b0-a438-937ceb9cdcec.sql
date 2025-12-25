-- Add team name columns to umbriago_games
ALTER TABLE public.umbriago_games
ADD COLUMN team_a_name text NOT NULL DEFAULT 'Team A',
ADD COLUMN team_b_name text NOT NULL DEFAULT 'Team B';