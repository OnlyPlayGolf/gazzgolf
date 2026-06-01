-- Ensure profiles rows are created/updated from Supabase Auth user metadata.
-- This makes signup-provided name + golf details appear immediately in the app.

-- Create or replace the trigger function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  computed_display_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  -- Prefer explicit display_name; fall back to full_name/name; finally email local-part.
  computed_display_name :=
    nullif(btrim(coalesce(
      meta->>'display_name',
      meta->>'full_name',
      meta->>'name',
      (coalesce(meta->>'first_name', '') || ' ' || coalesce(meta->>'last_name', ''))
    )), '');

  if computed_display_name is null then
    computed_display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    country,
    handicap,
    home_club
  )
  values (
    new.id,
    new.email,
    computed_display_name,
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'country', ''),
    nullif(meta->>'handicap', ''),
    nullif(meta->>'home_club', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    country = coalesce(public.profiles.country, excluded.country),
    handicap = coalesce(public.profiles.handicap, excluded.handicap),
    home_club = coalesce(public.profiles.home_club, excluded.home_club);

  return new;
end;
$$;

-- Recreate the trigger to ensure it uses the latest function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

