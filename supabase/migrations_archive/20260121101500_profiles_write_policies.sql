-- Allow users to create/update their own profile row.
-- Needed so new accounts can populate display_name/handicap/country/home_club immediately.

-- Insert own profile
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

-- Update own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

