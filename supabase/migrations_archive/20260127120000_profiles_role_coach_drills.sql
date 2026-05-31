-- 1) role on profiles
alter table public.profiles
add column if not exists role text not null default 'user';

-- 2) coach_drills table
create table if not exists public.coach_drills (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.coach_drills enable row level security;

-- 3) helper: is_coach
create or replace function public.is_coach(uid uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('coach','admin')
  );
$$;

-- 4) policies
drop policy if exists "coach_drills_select_own" on public.coach_drills;
create policy "coach_drills_select_own"
on public.coach_drills for select
using (coach_id = auth.uid());

drop policy if exists "coach_drills_insert_coach_only" on public.coach_drills;
create policy "coach_drills_insert_coach_only"
on public.coach_drills for insert
with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coach_drills_update_own" on public.coach_drills;
create policy "coach_drills_update_own"
on public.coach_drills for update
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists "coach_drills_delete_own" on public.coach_drills;
create policy "coach_drills_delete_own"
on public.coach_drills for delete
using (coach_id = auth.uid());
