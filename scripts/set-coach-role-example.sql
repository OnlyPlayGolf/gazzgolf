-- Set profiles.role to 'coach' or 'admin' for users who should access Coach AI.
-- Run in Supabase Dashboard -> SQL Editor (or via psql).
-- Replace <user-uuid> with the auth.users id (from Supabase Auth or profiles.id).

-- Single user:
-- update public.profiles set role = 'coach' where id = '<user-uuid>';

-- Example (uncomment and fix):
-- update public.profiles set role = 'coach' where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
