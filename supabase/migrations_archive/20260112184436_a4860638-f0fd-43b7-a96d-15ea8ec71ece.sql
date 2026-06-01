-- Add stats_mode column to rounds table for in-round stats tracking
ALTER TABLE public.rounds 
ADD COLUMN stats_mode text DEFAULT 'none';

-- Add a check constraint for valid values
ALTER TABLE public.rounds 
ADD CONSTRAINT rounds_stats_mode_check 
CHECK (stats_mode IN ('none', 'basic', 'strokes_gained'));

-- Add comment explaining the column
COMMENT ON COLUMN public.rounds.stats_mode IS 'In-round stats tracking mode: none, basic, or strokes_gained';