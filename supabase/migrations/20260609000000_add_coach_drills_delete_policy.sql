-- Add an RLS DELETE policy for coach_drills so owners can delete their own
-- saved drills from "My Drills".
--
-- Bug: the iOS delete (RLS-bound anon client, plain `.delete().eq("id", …)`)
-- silently matched ZERO rows because coach_drills has no DELETE policy — the
-- statement "succeeds", the row stays, and it reappears on the next fetch.
-- This mirrors the identical fix already applied to the sibling drill_results
-- table (20260121192800_add_drill_results_delete_policy.sql).
--
-- coach_id is the owning auth user id (stored lowercase by saveDrill and by the
-- generate-drill edge function's user.id), so `auth.uid() = coach_id` matches.

-- Enable RLS if not already enabled (idempotent; it is already effectively on,
-- which is why deletes were being filtered).
ALTER TABLE public.coach_drills ENABLE ROW LEVEL SECURITY;

-- Idempotent create (CREATE POLICY has no IF NOT EXISTS, so drop-then-create).
DROP POLICY IF EXISTS "Users can delete their own coach drills" ON public.coach_drills;
CREATE POLICY "Users can delete their own coach drills"
ON public.coach_drills
FOR DELETE
TO authenticated
USING (auth.uid() = coach_id);
