begin;

create table if not exists public.community_maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  run_key date not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  affected_count integer not null default 0 check (affected_count >= 0),
  error_code text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint community_maintenance_runs_unique_task_key unique (task_name, run_key)
);

create index if not exists community_maintenance_runs_status_idx
  on public.community_maintenance_runs (task_name, status, started_at desc);

alter table public.community_maintenance_runs enable row level security;
revoke all on table public.community_maintenance_runs from public, anon, authenticated;

create or replace function public.run_community_maintenance(p_run_key date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  affected integer := 0;
begin
  insert into public.community_maintenance_runs (task_name, run_key, status)
  values ('withdrawal_purge', p_run_key, 'running')
  on conflict (task_name, run_key) do nothing
  returning id into run_id;

  if run_id is null then
    return jsonb_build_object('status', 'already_processed', 'run_key', p_run_key);
  end if;

  begin
    select public.purge_due_community_withdrawals() into affected;

    update public.community_maintenance_runs
    set status = 'completed',
        affected_count = coalesce(affected, 0),
        completed_at = timezone('utc', now())
    where id = run_id;

    insert into public.community_admin_audit_logs (action, reason, metadata)
    values (
      'community_maintenance_completed',
      'scheduled_withdrawal_purge',
      jsonb_build_object('run_key', p_run_key, 'affected_count', coalesce(affected, 0))
    );

    return jsonb_build_object('status', 'completed', 'run_key', p_run_key, 'affected_count', coalesce(affected, 0));
  exception when others then
    update public.community_maintenance_runs
    set status = 'failed',
        error_code = left(sqlstate, 40),
        completed_at = timezone('utc', now())
    where id = run_id;

    insert into public.community_admin_audit_logs (action, reason, metadata)
    values (
      'community_maintenance_failed',
      'scheduled_withdrawal_purge',
      jsonb_build_object('run_key', p_run_key, 'sqlstate', sqlstate)
    );

    raise;
  end;
end;
$$;

revoke all on function public.run_community_maintenance(date) from public, anon, authenticated;
grant execute on function public.run_community_maintenance(date) to service_role;

commit;
