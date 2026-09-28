-- ETF Campus Kakao/Naver OAuth identities and transactions
-- Supabase PostgreSQL migration

create table if not exists public.community_oauth_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('kakao', 'naver')),
  provider_app_id text not null,
  subject_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_community_oauth_identity unique (provider, provider_app_id, subject_hash)
);

create index if not exists idx_community_oauth_identities_user_id
  on public.community_oauth_identities (user_id);

create table if not exists public.community_oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_id_hash text not null unique,
  provider text not null check (provider in ('kakao', 'naver')),
  origin text not null,
  return_to text not null,
  remember_me boolean not null default true,
  mode text not null default 'login' check (mode in ('login', 'link')),
  link_user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_community_oauth_tx_hash
  on public.community_oauth_transactions (tx_id_hash);

create index if not exists idx_community_oauth_tx_expiry
  on public.community_oauth_transactions (expires_at);

-- RLS Hardening: strictly forbid direct anon & authenticated access
alter table public.community_oauth_identities enable row level security;
alter table public.community_oauth_transactions enable row level security;

-- Revoke all table privileges from anon and authenticated
revoke all on public.community_oauth_identities from anon, authenticated;
revoke all on public.community_oauth_transactions from anon, authenticated;

-- Grant access only to service_role
grant all on public.community_oauth_identities to service_role;
grant all on public.community_oauth_transactions to service_role;

-- RPC 1: Record OAuth Transaction
create or replace function public.record_oauth_transaction(
  p_tx_id_hash text,
  p_provider text,
  p_origin text,
  p_return_to text,
  p_remember_me boolean default true,
  p_mode text default 'login',
  p_link_user_id uuid default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_expires timestamptz;
begin
  v_expires := coalesce(p_expires_at, timezone('utc', now()) + interval '10 minutes');

  insert into public.community_oauth_transactions (
    tx_id_hash, provider, origin, return_to, remember_me, mode, link_user_id, expires_at
  )
  values (
    p_tx_id_hash, p_provider, p_origin, p_return_to, coalesce(p_remember_me, true),
    coalesce(p_mode, 'login'), p_link_user_id, v_expires
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- RPC 2: Atomically Consume OAuth Transaction (Single-Use Replay Protection)
create or replace function public.consume_oauth_transaction(
  p_tx_id_hash text
)
returns table (
  id uuid,
  provider text,
  origin text,
  return_to text,
  remember_me boolean,
  mode text,
  link_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  return query
  update public.community_oauth_transactions
  set consumed_at = v_now
  where tx_id_hash = p_tx_id_hash
    and consumed_at is null
    and expires_at > v_now
  returning
    community_oauth_transactions.id,
    community_oauth_transactions.provider,
    community_oauth_transactions.origin,
    community_oauth_transactions.return_to,
    community_oauth_transactions.remember_me,
    community_oauth_transactions.mode,
    community_oauth_transactions.link_user_id;
end;
$$;

-- RPC 3: Resolve User by OAuth Identity
create or replace function public.resolve_oauth_identity(
  p_provider text,
  p_provider_app_id text,
  p_subject_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.community_oauth_identities
  where provider = p_provider
    and provider_app_id = p_provider_app_id
    and subject_hash = p_subject_hash;

  return v_user_id;
end;
$$;

-- RPC 4: Link/Confirm OAuth Identity to User
create or replace function public.link_oauth_identity(
  p_provider text,
  p_provider_app_id text,
  p_subject_hash text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_oauth_identities (
    provider, provider_app_id, subject_hash, user_id
  )
  values (
    p_provider, p_provider_app_id, p_subject_hash, p_user_id
  )
  on conflict (provider, provider_app_id, subject_hash)
  do update set
    user_id = excluded.user_id,
    updated_at = timezone('utc', now());

  return true;
end;
$$;

-- Revoke execute from public, anon, authenticated; grant only to service_role
revoke all on function public.record_oauth_transaction(text, text, text, text, boolean, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.record_oauth_transaction(text, text, text, text, boolean, text, uuid, timestamptz) to service_role;

revoke all on function public.consume_oauth_transaction(text) from public, anon, authenticated;
grant execute on function public.consume_oauth_transaction(text) to service_role;

revoke all on function public.resolve_oauth_identity(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_oauth_identity(text, text, text) to service_role;

revoke all on function public.link_oauth_identity(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.link_oauth_identity(text, text, text, uuid) to service_role;
