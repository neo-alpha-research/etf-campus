begin;

create table public.community_challenge_judgments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.community_challenge_cohorts(id) on delete cascade,
  participant_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  day_number integer not null,
  status text not null check (status in ('on_time', 'late', 'failed', 'appealed', 'appeal_approved', 'appeal_rejected')),
  rule_version text not null,
  submitted_at timestamptz not null,
  deadline_at timestamptz not null,
  judged_at timestamptz default now() not null,
  failure_reason text,
  unique (participant_profile_id, cohort_id, day_number)
);

create or replace view public.admin_community_challenge_dashboard
with (security_invoker = false)
as
select
  p.id as participant_id,
  p.cohort_id,
  c.title as cohort_title,
  prof.public_nickname,
  p.status as participant_status,
  p.payment_status,
  p.milestone_10,
  p.milestone_20,
  p.milestone_30,
  count(j.id) filter (where j.status in ('on_time', 'late', 'appeal_approved')) as approved_days,
  count(j.id) as total_judged_days
from public.community_challenge_participants p
join public.community_challenge_cohorts c on c.id = p.cohort_id
join public.user_profiles prof on prof.id = p.profile_id
left join public.community_challenge_judgments j on j.participant_profile_id = p.profile_id and j.cohort_id = p.cohort_id
group by p.id, p.cohort_id, c.title, prof.public_nickname, p.status, p.payment_status, p.milestone_10, p.milestone_20, p.milestone_30;

create or replace function public.bulk_insert_challenge_judgments(
  p_judgments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j record;
  target_milestone boolean;
  approved_count integer;
begin
  if public.current_community_role() not in ('admin') and auth.role() != 'service_role' then
    raise exception 'admin or service_role required';
  end if;

  for j in select * from jsonb_to_recordset(p_judgments) as x(cohort_id uuid, participant_profile_id uuid, post_id uuid, day_number integer, status text, rule_version text, submitted_at timestamptz, deadline_at timestamptz, failure_reason text) loop
    insert into public.community_challenge_judgments(
      cohort_id, participant_profile_id, post_id, day_number, status, rule_version, submitted_at, deadline_at, failure_reason
    ) values (
      j.cohort_id, j.participant_profile_id, j.post_id, j.day_number, j.status, j.rule_version, j.submitted_at, j.deadline_at, j.failure_reason
    ) on conflict (participant_profile_id, cohort_id, day_number) do nothing;
    
    -- update milestones
    select count(id) into approved_count 
    from public.community_challenge_judgments 
    where participant_profile_id = j.participant_profile_id 
      and cohort_id = j.cohort_id 
      and status in ('on_time', 'late', 'appeal_approved');
      
    update public.community_challenge_participants
    set milestone_10 = (approved_count >= 10),
        milestone_20 = (approved_count >= 20),
        milestone_30 = (approved_count >= 30)
    where profile_id = j.participant_profile_id and cohort_id = j.cohort_id;
  end loop;
end;
$$;

create or replace function public.admin_override_challenge_judgment(
  p_participant_profile_id uuid,
  p_cohort_id uuid,
  p_day_number integer,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_community_role() not in ('admin') then
    raise exception 'admin required';
  end if;

  update public.community_challenge_judgments
  set status = p_new_status
  where participant_profile_id = p_participant_profile_id
    and cohort_id = p_cohort_id
    and day_number = p_day_number;
end;
$$;

commit;
