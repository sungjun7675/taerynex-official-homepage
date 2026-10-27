-- Separate release prerequisite: review/authorize installation before applying
-- ONLY to edfrlptpeuhjsgxdfwke. No network extension, secrets or external calls.
-- Confirm pg_cron is available on this project's actual Postgres version.
begin;
create extension if not exists pg_cron;
select cron.schedule('website-contact-retention', '17 3 * * *',
  'select website_contact_private.purge();');
commit;
-- Read back cron.job and, after the first scheduled run, cron.job_run_details.
-- Intake/inbox purges are defense in depth, never evidence of scheduled runs.
