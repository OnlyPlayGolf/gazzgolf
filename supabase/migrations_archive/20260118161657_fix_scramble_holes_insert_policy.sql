-- Fix scramble_holes INSERT policy to match UPDATE policy
-- Allow both game owners AND event creators to insert holes

DROP POLICY IF EXISTS "Users can insert holes to their scramble games" ON public.scramble_holes;
CREATE POLICY "Users can insert holes to their scramble games"
ON public.scramble_holes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM scramble_games g
    WHERE g.id = scramble_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);
