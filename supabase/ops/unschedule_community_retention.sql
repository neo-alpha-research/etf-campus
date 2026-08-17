-- Production-only operator procedure. This disables the scheduled purge without deleting run history.

do $unschedule$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'etf-campus-community-retention-purge';
end;
$unschedule$;

select jobid, jobname, schedule, active
from cron.job
where jobname = 'etf-campus-community-retention-purge';

select jobid, runid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc
limit 30;
