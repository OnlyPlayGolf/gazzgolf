-- Lock profile role: users cannot change their own role via UPDATE.
-- Role can only be set by service_role (admin dashboard, Stripe webhook, etc.)

-- 1) Unify default to 'player' and backfill any 'user' values
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'player';
UPDATE public.profiles SET role = 'player' WHERE role = 'user';

-- 2) Replace the permissive update policy with one that prevents role changes
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);
