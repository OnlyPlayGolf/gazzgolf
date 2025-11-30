-- Drop the conflicting RLS policies
DROP POLICY IF EXISTS "Round players can insert their own holes" ON public.holes;
DROP POLICY IF EXISTS "holes_insert_player_owned" ON public.holes;
DROP POLICY IF EXISTS "Round players can update their own holes" ON public.holes;
DROP POLICY IF EXISTS "holes_update_player_owned" ON public.holes;

-- Create new policy: Round owner can insert holes for any player in their round
CREATE POLICY "Round owner can insert holes"
ON public.holes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
);

-- Create new policy: Round owner can update holes in their round  
CREATE POLICY "Round owner can update holes"
ON public.holes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rounds r
    WHERE r.id = holes.round_id AND r.user_id = auth.uid()
  )
);