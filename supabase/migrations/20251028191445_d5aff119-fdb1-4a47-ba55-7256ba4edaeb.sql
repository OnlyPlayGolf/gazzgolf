-- Add player_id column to holes table to track which player each hole belongs to
ALTER TABLE holes ADD COLUMN player_id uuid REFERENCES round_players(id);

-- Create index for better query performance
CREATE INDEX idx_holes_player_id ON holes(player_id);

-- Update existing holes to link to the round creator's player record
UPDATE holes h
SET player_id = (
  SELECT rp.id 
  FROM round_players rp
  JOIN rounds r ON r.id = rp.round_id
  WHERE r.id = h.round_id 
  AND rp.user_id = r.user_id
  LIMIT 1
);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view holes from their own rounds" ON holes;
DROP POLICY IF EXISTS "Users can insert holes to their own rounds" ON holes;
DROP POLICY IF EXISTS "Users can update holes from their own rounds" ON holes;
DROP POLICY IF EXISTS "Users can delete holes from their own rounds" ON holes;

-- Create new RLS policies that allow round participants to manage holes
CREATE POLICY "Users can view holes in rounds they're part of"
ON holes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM round_players rp
    WHERE rp.round_id = holes.round_id
    AND rp.user_id = auth.uid()
  )
);

CREATE POLICY "Round owner can insert holes for all players"
ON holes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id
    AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Round owner can update holes for all players"
ON holes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id
    AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Round owner can delete holes for all players"
ON holes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id
    AND r.user_id = auth.uid()
  )
);