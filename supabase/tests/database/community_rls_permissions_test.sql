begin;

select plan(27);

select has_table('public', 'user_profiles', 'user_profiles table should exist');
select has_table('public', 'community_posts', 'community_posts table should exist');
select has_table('public', 'community_comments', 'community_comments table should exist');
select has_table('public', 'consent_records', 'consent_records table should exist');
select has_view('public', 'community_public_posts', 'public post view should exist');
select has_view('public', 'community_public_comments', 'public comment view should exist');

select ok((select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass), 'user profiles should keep RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.community_posts'::regclass), 'posts should keep RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.community_comments'::regclass), 'comments should keep RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.consent_records'::regclass), 'consents should keep RLS enabled');

select ok(has_table_privilege('anon', 'public.community_public_posts', 'select'), 'anon may read public posts');
select ok(has_table_privilege('anon', 'public.community_public_comments', 'select'), 'anon may read public comments');
select ok(has_table_privilege('anon', 'public.community_categories', 'select'), 'anon may read active categories through the permitted table');
select ok(not has_table_privilege('anon', 'public.user_profiles', 'select'), 'anon may not read profiles');
select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'insert'), 'members may not directly insert profiles');
select ok(not has_table_privilege('authenticated', 'public.community_posts', 'insert'), 'members may not directly insert posts');
select ok(not has_table_privilege('authenticated', 'public.community_posts', 'update'), 'members may not directly update posts');
select ok(not has_table_privilege('authenticated', 'public.community_comments', 'delete'), 'members may not directly delete comments');
select ok(not has_table_privilege('authenticated', 'public.consent_records', 'update'), 'consent history is not directly mutable');
select ok(not has_table_privilege('authenticated', 'public.community_user_roles', 'update'), 'members may not change their role');

select ok(not has_function_privilege('authenticated', 'public.assign_initial_community_admin(uuid,text)', 'execute'), 'members may not assign initial admin');
select ok(not has_function_privilege('anon', 'public.assign_initial_community_admin(uuid,text)', 'execute'), 'anon may not assign initial admin');
select ok(has_function_privilege('service_role', 'public.assign_initial_community_admin(uuid,text)', 'execute'), 'service role may assign initial admin');
select ok(has_function_privilege('service_role', 'public.consume_community_rate_limit(text,integer,integer)', 'execute'), 'service role may consume rate limits');
select ok(not has_function_privilege('authenticated', 'public.consume_community_rate_limit(text,integer,integer)', 'execute'), 'members may not consume rate limits directly');

select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'community_public_posts'
    and column_name in ('author_profile_id', 'author_user_id', 'email', 'user_id', 'id')
), 'public post view must not expose internal author identifiers');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'community_public_comments'
    and column_name in ('author_profile_id', 'author_user_id', 'email', 'user_id', 'id')
), 'public comment view must not expose internal author identifiers');

select * from finish();
rollback;
