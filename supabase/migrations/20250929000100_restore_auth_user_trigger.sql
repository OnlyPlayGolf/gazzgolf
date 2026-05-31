-- Restore the on_auth_user_created trigger lost by the squash.
--
-- WHY THIS EXISTS
--   scripts/squash-baseline.sh dumps prod with `pg_dump --schema public`, which
--   captures public-schema objects only. The profile-creation trigger
--   `on_auth_user_created` lives on `auth.users` (the AUTH schema), so it was
--   NOT included in the baseline — even though its function
--   `public.handle_new_user()` WAS (that's a public-schema function, line ~3030
--   of the baseline).
--
--   Without this trigger, every INSERT into auth.users creates no public.profiles
--   row. That breaks: (a) real signup in the app, (b) the local seed (the
--   friendships FK to profiles fails), and (c) the handle_new_user pgTAP test
--   (profiles come back NULL).
--
-- SAFETY / IDEMPOTENCE
--   DROP ... IF EXISTS + CREATE is safe to replay. Prod ALREADY has this trigger,
--   so when this migration eventually reaches prod via `supabase db push` it is a
--   no-op re-create (after the migration-history repair noted in
--   squash-baseline.sh's header). Locally it is what makes `supabase db reset`
--   produce profiles.
--
-- NOTE (broader): any OTHER custom trigger on a non-public schema table (auth.*,
--   storage.*) was likewise dropped by the squash. on_auth_user_created is the
--   one the app + tests depend on; a fuller audit of auth/storage triggers vs
--   prod is worth doing before relying on the baseline for more than these tests.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
