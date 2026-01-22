-- Add RLS DELETE policy for drill_results table
-- This allows users to delete their own drill results

-- Enable RLS if not already enabled (idempotent)
ALTER TABLE public.drill_results ENABLE ROW LEVEL SECURITY;

-- Create DELETE policy for drill_results
-- Users can only delete their own drill results
CREATE POLICY IF NOT EXISTS "Users can delete their own drill results"
ON public.drill_results
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
