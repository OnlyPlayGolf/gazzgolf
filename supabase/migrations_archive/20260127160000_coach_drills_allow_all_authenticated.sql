-- Allow any authenticated user to insert into coach_drills (Coach AI for all users).
-- Drop the coach-only insert policy and create one that allows insert when coach_id = auth.uid().

drop policy if exists "coach_drills_insert_coach_only" on public.coach_drills;
create policy "coach_drills_insert_own"
on public.coach_drills for insert
with check (coach_id = auth.uid());
