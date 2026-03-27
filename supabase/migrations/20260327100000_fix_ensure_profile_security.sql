-- Fix: ensure_profile RPC must verify caller is the profile owner.
-- Without this check, any authenticated user could call ensure_profile
-- with another user's ID and overwrite their profile fields.

create or replace function public.ensure_profile(
  p_user_id uuid,
  p_email text default null,
  p_display_name text default null,
  p_handicap text default null,
  p_home_club text default null,
  p_country text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only allow users to ensure their own profile
  if p_user_id <> auth.uid() then
    raise exception 'unauthorized: p_user_id must match authenticated user';
  end if;

  insert into public.profiles (id, email, display_name, handicap, home_club, country)
  values (
    p_user_id,
    p_email,
    nullif(btrim(p_display_name), ''),
    nullif(btrim(p_handicap), ''),
    nullif(btrim(p_home_club), ''),
    nullif(btrim(p_country), '')
  )
  on conflict (id) do update
  set
    email      = coalesce(excluded.email, profiles.email),
    display_name = case when nullif(profiles.display_name, '') is null
                        then excluded.display_name
                        else profiles.display_name end,
    handicap   = case when nullif(profiles.handicap, '') is null
                      then excluded.handicap
                      else profiles.handicap end,
    home_club  = case when nullif(profiles.home_club, '') is null
                      then excluded.home_club
                      else profiles.home_club end,
    country    = case when nullif(profiles.country, '') is null
                      then excluded.country
                      else profiles.country end;
end;
$$;

-- Add display_name length constraint
alter table public.profiles drop constraint if exists display_name_length;
alter table public.profiles add constraint display_name_length check (length(display_name) <= 50);
