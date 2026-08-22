begin;

create or replace function public.record_due_community_challenge_evaluations(p_run_key date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.community_challenge_day_evaluations (
    participant_id,
    day_number,
    status,
    determined_at,
    determined_by,
    rule_version,
    reason_code
  )
  select
    participant.id,
    (p_run_key - cohort.starts_on)::integer,
    case when exists (
      select 1 from public.community_challenge_records record
      where record.participant_id = participant.id
        and record.day_number = (p_run_key - cohort.starts_on)::integer
    ) then 'submitted_on_time' else 'not_submitted' end,
    timezone('utc', now()),
    null,
    'challenge-v1',
    'scheduled_fact_record'
  from public.community_challenge_participants participant
  join public.community_challenge_cohorts cohort on cohort.id = participant.cohort_id
  where participant.status = 'active'
    and cohort.status in ('active', 'grace_review')
    and (p_run_key - cohort.starts_on)::integer between 1 and 30
  on conflict (participant_id, day_number, rule_version) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.run_community_maintenance(p_run_key date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  purge_count integer := 0;
  evaluation_count integer := 0;
begin
  insert into public.community_maintenance_runs (task_name, run_key, status)
  values ('community_daily_maintenance', p_run_key, 'running')
  on conflict (task_name, run_key) do nothing
  returning id into run_id;

  if run_id is null then
    return jsonb_build_object('status', 'already_processed', 'run_key', p_run_key);
  end if;

  begin
    select public.purge_due_community_withdrawals() into purge_count;
    select public.record_due_community_challenge_evaluations(p_run_key) into evaluation_count;

    update public.community_maintenance_runs
    set status = 'completed',
        affected_count = coalesce(purge_count, 0) + coalesce(evaluation_count, 0),
        completed_at = timezone('utc', now())
    where id = run_id;

    insert into public.community_admin_audit_logs (action, reason, metadata)
    values (
      'community_maintenance_completed',
      'scheduled_withdrawal_purge_and_challenge_evaluation',
      jsonb_build_object('run_key', p_run_key, 'purge_count', coalesce(purge_count, 0), 'evaluation_count', coalesce(evaluation_count, 0))
    );

    return jsonb_build_object('status', 'completed', 'run_key', p_run_key, 'affected_count', coalesce(purge_count, 0) + coalesce(evaluation_count, 0));
  exception when others then
    update public.community_maintenance_runs
    set status = 'failed',
        error_code = left(sqlstate, 40),
        completed_at = timezone('utc', now())
    where id = run_id;

    insert into public.community_admin_audit_logs (action, reason, metadata)
    values (
      'community_maintenance_failed',
      'scheduled_withdrawal_purge_and_challenge_evaluation',
      jsonb_build_object('run_key', p_run_key, 'sqlstate', sqlstate)
    );

    raise;
  end;
end;
$$;

revoke all on function public.record_due_community_challenge_evaluations(date) from public, anon, authenticated;
grant execute on function public.record_due_community_challenge_evaluations(date), public.run_community_maintenance(date) to service_role;

commit;
