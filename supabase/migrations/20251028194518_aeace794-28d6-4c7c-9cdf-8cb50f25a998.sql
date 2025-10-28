-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view players in their rounds" ON round_players;

-- Create a new policy that checks the rounds table instead of recursively checking round_players
CREATE POLICY "Users can view players in their rounds"
ON round_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM rounds r
    WHERE r.id = round_players.round_id
    AND r.user_id = auth.uid()
  )
);