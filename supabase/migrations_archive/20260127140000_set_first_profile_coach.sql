-- Set the first profile (by id) to role = 'coach' so at least one user can access Coach AI.
-- Run "npx supabase db push" to apply. Revoke or change later via Dashboard if needed.
update public.profiles
set role = 'coach'
where id = (select id from public.profiles order by id asc limit 1);
