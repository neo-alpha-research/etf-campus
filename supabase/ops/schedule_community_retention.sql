-- Production-only operator procedure. Do NOT run in local development or Preview.
-- Daily 03:20 Asia/Seoul is 18:20 UTC on the previous calendar day.
-- No project URL, key, user email, or other secret belongs in this file.

create extension if not exists pg_cron with schema pg_catalog;

do $schedule$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'etf-campus-community-retention-purge';

  perform cron.schedule(
    'etf-campus-community-retention-purge',
    '20 18 * * *',
    $command$select public.purge_due_community_withdrawals();$command$
  );
end;
$schedule$;

-- Verify one active job only.
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'etf-campus-community-retention-purge';

-- Daily health check. A non-success status, repeated failures, or an unexpected runtime requires operator review.
select jobid, runid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'etf-campus-community-retention-purge')
order by start_time desc
limit 30;

-- Manual retry for an operator-approved incident. Run once after reviewing the affected withdrawal queue.
-- select public.purge_due_community_withdrawals();
