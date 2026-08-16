begin;

-- Correct the Phase 2 marker contract without rewriting previously applied migrations.
drop function if exists public.mark_community_withdrawal_auth_failed(uuid);
drop function if exists public.mark_community_withdrawal_auth_deleted(uuid);

create or replace function public.request_community_withdrawal(p_disposition public.community_content_disposition)
returns table (request_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_request_id uuid;
  existing_status text;
  created_request_id uuid;
  created_status text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;

  select withdrawal.id, withdrawal.status into existing_request_id, existing_status
  from public.community_withdrawal_requests withdrawal
  where withdrawal.former_user_id = current_user_id and withdrawal.completed_at is null
  order by withdrawal.requested_at desc
  limit 1
  for update;
  if existing_request_id is not null then
    return query select existing_request_id, existing_status;
    return;
  end if;

  if p_disposition = 'delete' then
    update public.community_posts
    set deleted_at = coalesce(deleted_at, timezone('utc', now())),
        deletion_requested_at = coalesce(deletion_requested_at, timezone('utc', now()))
    where author_profile_id = current_user_id and deleted_at is null;
    update public.community_comments
    set deleted_at = coalesce(deleted_at, timezone('utc', now())),
        deletion_requested_at = coalesce(deletion_requested_at, timezone('utc', now()))
    where author_profile_id = current_user_id and deleted_at is null;
  end if;

  insert into public.community_withdrawal_requests (
    former_user_id, content_disposition, requested_at, content_purge_due_at, status, updated_at
  ) values (
    current_user_id,
    p_disposition,
    timezone('utc', now()),
    case when p_disposition = 'delete' then timezone('utc', now()) + interval '30 days' else null end,
    'requested',
    timezone('utc', now())
  )
  returning id, community_withdrawal_requests.status into created_request_id, created_status;

  return query select created_request_id, created_status;
end;
$$;

create function public.mark_community_withdrawal_auth_failed(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare changed boolean := false;
begin
  update public.community_withdrawal_requests
  set status = 'auth_delete_failed',
      retry_count = retry_count + 1,
      last_error_code = 'auth_delete_failed',
      updated_at = timezone('utc', now())
  where id = p_request_id
    and completed_at is null
    and status in ('requested', 'auth_delete_failed')
  returning true into changed;
  return coalesce(changed, false);
end;
$$;

create function public.mark_community_withdrawal_auth_deleted(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare changed boolean := false;
begin
  update public.community_withdrawal_requests
  set status = 'auth_deleted',
      account_deleted_at = coalesce(account_deleted_at, timezone('utc', now())),
      completed_at = case when content_disposition = 'anonymize' then coalesce(completed_at, timezone('utc', now())) else completed_at end,
      last_error_code = null,
      updated_at = timezone('utc', now())
  where id = p_request_id
    and status in ('requested', 'auth_delete_failed', 'auth_deleted')
  returning true into changed;
  return coalesce(changed, false);
end;
$$;

create or replace function public.list_community_withdrawal_recovery_queue()
returns table (request_id uuid, status text, retry_count integer, requested_at timestamptz, last_error_code text)
language sql stable security definer set search_path = ''
as $$
  select withdrawal.id, withdrawal.status, withdrawal.retry_count, withdrawal.requested_at, withdrawal.last_error_code
  from public.community_withdrawal_requests withdrawal
  where withdrawal.status = 'auth_delete_failed' and withdrawal.completed_at is null
  order by withdrawal.requested_at asc;
$$;

revoke all on function public.request_community_withdrawal(public.community_content_disposition) from public, anon;
revoke all on function public.mark_community_withdrawal_auth_failed(uuid) from public, anon, authenticated;
revoke all on function public.mark_community_withdrawal_auth_deleted(uuid) from public, anon, authenticated;
revoke all on function public.list_community_withdrawal_recovery_queue() from public, anon, authenticated;
grant execute on function public.request_community_withdrawal(public.community_content_disposition) to authenticated;
grant execute on function public.mark_community_withdrawal_auth_failed(uuid), public.mark_community_withdrawal_auth_deleted(uuid), public.list_community_withdrawal_recovery_queue() to service_role;

commit;
