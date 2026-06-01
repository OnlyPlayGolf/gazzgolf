-- Add unique constraint for upsert operations on holes
ALTER TABLE holes DROP CONSTRAINT IF EXISTS holes_round_player_hole_unique;
ALTER TABLE holes ADD CONSTRAINT holes_round_player_hole_unique UNIQUE (round_id, player_id, hole_number);