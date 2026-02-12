-- Fix: Add missing INSERT, SELECT, and UPDATE RLS policies for drill_results
-- RLS was enabled but only a DELETE policy existed, blocking all saves and reads

-- INSERT: Users can insert their own drill results
CREATE POLICY "Users can insert their own drill results"
ON public.drill_results
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SELECT: Users can read all drill results (needed for leaderboards + history)
CREATE POLICY "Anyone can read drill results"
ON public.drill_results
FOR SELECT
TO authenticated
USING (true);

-- UPDATE: Users can update their own drill results
CREATE POLICY "Users can update their own drill results"
ON public.drill_results
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
