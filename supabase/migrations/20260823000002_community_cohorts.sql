begin;

create type public.community_cohort_status as enum ('recruiting', 'in_progress', 'ended');
create type public.community_participant_status as enum ('pending', 'approved', 'rejected');
create type public.community_payment_status as enum ('pending', 'paid', 'free');

create table if not exists public.community_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_number integer not null unique,
  title text not null,
  start_date date not null,
  end_date date not null,
  status public.community_cohort_status not null default 'recruiting',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_participants (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.community_cohorts(id) on delete restrict,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  pension_type text not null,
  participation_goal text not null,
  agreed_to_daily_record boolean not null,
  applied_at timestamptz not null default timezone('utc', now()),
  status public.community_participant_status not null default 'pending',
  payment_status public.community_payment_status not null default 'pending',
  milestone_10 boolean not null default false,
  milestone_20 boolean not null default false,
  milestone_30 boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_participants_cohort_user_unique unique (cohort_id, user_profile_id)
);

create index if not exists community_participants_cohort_id_idx on public.community_participants(cohort_id);
create index if not exists community_participants_user_profile_id_idx on public.community_participants(user_profile_id);

-- RLS Policies
alter table public.community_cohorts enable row level security;
alter table public.community_participants enable row level security;

-- Cohorts are readable by everyone
create policy "Cohorts are readable by everyone" on public.community_cohorts
  for select using (true);

-- Participants are readable by the user themselves or by admins/moderators
create policy "Participants are readable by owner or admins" on public.community_participants
  for select using (
    auth.uid() = user_profile_id
    or public.current_community_role() in ('admin', 'moderator')
  );

-- Participants can be created by the user
create policy "Participants can apply for themselves" on public.community_participants
  for insert with check (
    auth.uid() = user_profile_id
    and public.current_community_role() in ('member', 'moderator', 'admin')
  );

-- Participants can be updated by admins/moderators
create policy "Participants can be updated by admins" on public.community_participants
  for update using (
    public.current_community_role() in ('admin', 'moderator')
  );

-- Function to apply for a cohort
create or replace function public.apply_community_cohort(
  p_cohort_number integer,
  p_pension_type text,
  p_participation_goal text,
  p_agreed_to_daily_record boolean
)
returns table (participant_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_cohort_id uuid;
  created_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if public.current_community_role() not in ('member', 'admin', 'moderator') or not public.has_community_nickname() then raise exception 'community member profile required'; end if;
  
  select id into target_cohort_id from public.community_cohorts where cohort_number = p_cohort_number and status = 'recruiting';
  if target_cohort_id is null then raise exception 'recruiting cohort not found'; end if;
  
  if char_length(btrim(p_participation_goal)) not between 2 and 240 then raise exception 'invalid goal length'; end if;
  if not p_agreed_to_daily_record then raise exception 'must agree to daily record'; end if;

  insert into public.community_participants (
    cohort_id, user_profile_id, pension_type, participation_goal, agreed_to_daily_record
  ) values (
    target_cohort_id, current_user_id, p_pension_type, btrim(p_participation_goal), p_agreed_to_daily_record
  ) returning id into created_id;

  return query select created_id;
end;
$$;

revoke all on function public.apply_community_cohort(integer, text, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_community_cohort(integer, text, text, boolean) to authenticated;

-- Insert a default cohort for testing
insert into public.community_cohorts (cohort_number, title, start_date, end_date, status)
values (1, '제1기 30일 ETF 학습 챌린지', '2026-09-01', '2026-09-30', 'recruiting')
on conflict (cohort_number) do nothing;

commit;
