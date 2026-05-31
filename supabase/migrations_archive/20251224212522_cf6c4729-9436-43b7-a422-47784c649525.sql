-- Add mulligan support to match_play_games
ALTER TABLE match_play_games 
ADD COLUMN IF NOT EXISTS mulligans_per_player integer DEFAULT 0;

-- Add mulligan tracking to match_play_holes
ALTER TABLE match_play_holes 
ADD COLUMN IF NOT EXISTS player_1_mulligan boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player_2_mulligan boolean DEFAULT false;