-- Add mulligan tracking columns to copenhagen_holes
ALTER TABLE public.copenhagen_holes 
ADD COLUMN IF NOT EXISTS player_1_mulligan boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player_2_mulligan boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player_3_mulligan boolean DEFAULT false;