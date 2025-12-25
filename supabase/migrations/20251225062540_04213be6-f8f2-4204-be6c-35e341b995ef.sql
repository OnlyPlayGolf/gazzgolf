-- Add rolls and double columns to wolf_games table
ALTER TABLE public.wolf_games
ADD COLUMN IF NOT EXISTS rolls_per_player integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS roll_history jsonb DEFAULT '[]'::jsonb;

-- Add rolls and double columns to wolf_holes table
ALTER TABLE public.wolf_holes
ADD COLUMN IF NOT EXISTS multiplier integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS double_called_by integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS double_back_called boolean DEFAULT false;