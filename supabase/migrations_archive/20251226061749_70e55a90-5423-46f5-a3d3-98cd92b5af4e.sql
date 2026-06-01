-- Add mulligans_per_player column to best_ball_games table
ALTER TABLE public.best_ball_games 
ADD COLUMN mulligans_per_player integer DEFAULT 0;