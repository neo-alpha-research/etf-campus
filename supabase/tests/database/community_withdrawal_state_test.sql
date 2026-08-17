begin;

select plan(15);

select has_function('public', 'request_community_withdrawal', array['public.community_content_disposition'], 'withdrawal request RPC should exist');
select has_function('public', 'mark_community_withdrawal_auth_failed', array['uuid'], 'failed marker RPC should exist');
select has_function('public', 'mark_community_withdrawal_auth_deleted', array['uuid'], 'deleted marker RPC should exist');
select has_function('public', 'purge_due_community_withdrawals', array[]::text[], 'purge RPC should exist');
select has_function('public', 'append_community_consent', array['text', 'text', 'boolean'], 'append consent RPC should exist');
select has_function('public', 'list_community_consents', array[]::text[], 'list consent RPC should exist');
select has_function('public', 'withdraw_community_marketing_consent', array[]::text[], 'marketing withdrawal RPC should exist');
select has_function('public', 'create_community_post', array['text', 'text', 'text'], 'create post RPC should exist');
select has_function('public', 'create_community_comment', array['uuid', 'text'], 'create comment RPC should exist');
select has_function('public', 'update_community_post', array['uuid', 'text', 'text', 'text'], 'update post RPC should exist');
select has_function('public', 'soft_delete_community_comment', array['uuid'], 'soft delete comment RPC should exist');
select has_function('public', 'purge_due_community_withdrawals', array[]::text[], 'purge RPC remains callable as a repeatable function declaration');
select has_function('public', 'list_community_withdrawal_recovery_queue', array[]::text[], 'recovery queue RPC should exist');
select ok(not has_function_privilege('authenticated', 'public.mark_community_withdrawal_auth_failed(uuid)', 'execute'), 'member cannot mark withdrawal failure');
select ok(has_function_privilege('service_role', 'public.mark_community_withdrawal_auth_deleted(uuid)', 'execute'), 'service role can complete withdrawal state');

select * from finish();
rollback;
