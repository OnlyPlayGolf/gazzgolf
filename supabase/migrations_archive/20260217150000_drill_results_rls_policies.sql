-- Fix: Ensure INSERT and SELECT RLS policies exist for drill_results.
-- RLS was enabled in 20260121192800 but may be missing INSERT/SELECT policies.

-- Drop and recreate to ensure correct definitions
DROP POLICY IF EXISTS "Users can insert their own drill results" ON public.drill_results;
DROP POLICY IF EXISTS "Authenticated users can read all drill results" ON public.drill_results;
DROP POLICY IF EXISTS "Users can read their own drill results" ON public.drill_results;
DROP POLICY IF EXISTS "Users can update their own drill results" ON public.drill_results;

-- Allow users to insert their own drill results
CREATE POLICY "Users can insert their own drill results"
ON public.drill_results
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to read all drill results (needed for leaderboards)
CREATE POLICY "Authenticated users can read all drill results"
ON public.drill_results
FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own drill results
CREATE POLICY "Users can update their own drill results"
ON public.drill_results
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
