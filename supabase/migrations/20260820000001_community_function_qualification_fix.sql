-- Fix function qualification and search_path issues caused by duplicate files
-- 멱등성을 위해 create or replace function 구문 사용

create or replace function public.create_community_post(p_category_slug text, p_title text, p_body_text text)
returns table (slug uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  category_uuid uuid;
  created_slug uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if public.current_community_role() not in ('member', 'admin') or not public.has_community_nickname() then raise exception 'community member profile required'; end if;
  if char_length(btrim(p_title)) not between 2 and 120 or char_length(btrim(p_body_text)) not between 2 and 6000 then raise exception 'invalid post length'; end if;
  if p_title ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'html is not allowed'; end if;
  select id into category_uuid from public.community_categories where public.community_categories.slug = p_category_slug and public.community_categories.is_active;
  if category_uuid is null then raise exception 'category not found'; end if;
  insert into public.community_posts(category_id, author_profile_id, title, body_text) values (category_uuid, current_user_id, btrim(p_title), btrim(p_body_text)) returning community_posts.slug into created_slug;
  return query select created_slug;
end;
$$;

create or replace function public.update_community_post(p_slug uuid, p_category_slug text, p_title text, p_body_text text)
returns table (slug uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  category_uuid uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if char_length(btrim(p_title)) not between 2 and 120 or char_length(btrim(p_body_text)) not between 2 and 6000 then raise exception 'invalid post length'; end if;
  if p_title ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'html is not allowed'; end if;
  select id into category_uuid from public.community_categories where public.community_categories.slug = p_category_slug and public.community_categories.is_active;
  if category_uuid is null then raise exception 'category not found'; end if;
  update public.community_posts set category_id = category_uuid, title = btrim(p_title), body_text = btrim(p_body_text)
  where community_posts.slug = p_slug and community_posts.author_profile_id = current_user_id and community_posts.deleted_at is null;
  if not found then raise exception 'post not found or forbidden'; end if;
  return query select p_slug;
end;
$$;

create or replace function public.current_community_role()
returns public.community_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.community_user_roles.role from public.community_user_roles where user_id = auth.uid()),
    'guest'::public.community_role
  );
$$;

create or replace function public.bootstrap_community_profile(
  p_public_nickname text,
  p_interest_account_type text default null,
  p_investment_experience text default null
)
returns table (public_nickname text, role public.community_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_nickname text := btrim(p_public_nickname);
  resolved_role public.community_role;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if char_length(normalized_nickname) < 2 or char_length(normalized_nickname) > 24 then
    raise exception 'invalid nickname length';
  end if;
  if normalized_nickname !~ '^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.-]+$' then
    raise exception 'invalid nickname format';
  end if;

  insert into public.user_profiles (id, public_nickname, interest_account_type, investment_experience)
  values (current_user_id, normalized_nickname, p_interest_account_type, p_investment_experience)
  on conflict (id) do update
  set public_nickname = excluded.public_nickname,
      interest_account_type = excluded.interest_account_type,
      investment_experience = excluded.investment_experience;

  insert into public.community_user_roles (user_id, role, reason)
  values (current_user_id, 'member', 'authenticated profile bootstrap')
  on conflict (user_id) do nothing;

  select public.community_user_roles.role into resolved_role from public.community_user_roles where user_id = current_user_id;
  return query select normalized_nickname, resolved_role;
end;
$$;
