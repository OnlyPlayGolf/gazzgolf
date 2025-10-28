-- Drop the old constraint that doesn't include player_id
ALTER TABLE holes DROP CONSTRAINT IF EXISTS holes_round_id_hole_number_key;

-- Ensure the correct constraint exists with player_id
-- First drop it if it exists to recreate it properly
ALTER TABLE holes DROP CONSTRAINT IF EXISTS holes_round_player_hole_unique;

-- Create the correct unique constraint on round_id, player_id, and hole_number
ALTER TABLE holes ADD CONSTRAINT holes_round_player_hole_unique 
UNIQUE (round_id, player_id, hole_number);