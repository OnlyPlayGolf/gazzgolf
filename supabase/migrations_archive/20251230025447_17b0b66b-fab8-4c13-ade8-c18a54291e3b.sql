-- Add starting_hole column to rounds table to track which hole the round starts from
-- This allows proper handling of back 9 rounds (starting at hole 10)
ALTER TABLE public.rounds ADD COLUMN starting_hole integer DEFAULT 1;