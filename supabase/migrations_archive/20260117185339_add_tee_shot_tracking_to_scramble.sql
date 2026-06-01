-- Add team_tee_shots column to scramble_holes table
-- This stores which player's tee shot was used for each team on each hole
-- Format: JSONB object { teamId: playerId }
ALTER TABLE public.scramble_holes
ADD COLUMN IF NOT EXISTS team_tee_shots JSONB NOT NULL DEFAULT '{}'::jsonb;
