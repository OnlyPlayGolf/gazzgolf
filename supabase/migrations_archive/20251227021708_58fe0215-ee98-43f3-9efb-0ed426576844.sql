-- Fix: replace RPC functions safely by dropping first (return type changed)

drop function if exists public.get_public_profile(uuid);
drop function if exists public.search_profiles(text, integer);

-- Improve friend search to work even when profiles.display_name/username are empty
-- by allowing partial email matches (email is NOT returned) and by returning a safe display_name fallback.

create function public.search_profiles(q text, max_results integer default 10)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  country text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), nullif(split_part(coalesce(p.email, ''), '@', 1), '')) as display_name,
    p.avatar_url,
    p.country
  from public.profiles p
  where
    auth.uid() is not null
    and p.id <> auth.uid()
    and length(trim(coalesce(q, ''))) >= 3
    and (
      coalesce(p.username, '') ilike '%' || q || '%'
      or coalesce(p.display_name, '') ilike '%' || q || '%'
      -- allow matching by email (partial), but do not return email
      or coalesce(p.email, '') ilike '%' || q || '%'
    )
  order by
    case
      when coalesce(p.username, '') ilike q || '%' then 0
      when coalesce(p.display_name, '') ilike q || '%' then 1
      when coalesce(p.email, '') ilike q || '%' then 2
      else 3
    end,
    p.created_at desc nulls last
  limit least(coalesce(max_results, 10), 25);
$$;

create function public.get_public_profile(target_user_id uuid)
returns table (
  avatar_url text,
  country text,
  display_name text,
  handicap text,
  home_club text,
  id uuid,
  username text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.avatar_url,
    p.country,
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), nullif(split_part(coalesce(p.email, ''), '@', 1), '')) as display_name,
    p.handicap,
    p.home_club,
    p.id,
    p.username
  from public.profiles p
  where
    auth.uid() is not null
    and p.id = target_user_id
  limit 1;
$$;