-- Fire the send-push Edge Function once a minute. Requires pg_cron + pg_net
-- (both available on the Supabase free tier). Apply AFTER the function is
-- deployed and its VAPID_PRIVATE_KEY + CRON_SECRET secrets are set.
--
-- Replace before applying:
--   <PROJECT_REF>  → your project ref (e.g. bzcanpehaoeminjbzpvq)
--   <CRON_SECRET>  → a long random string, also set as the function's CRON_SECRET secret

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop a prior schedule of the same name before re-creating.
select cron.unschedule('pulse-send-push')
where exists (select 1 from cron.job where jobname = 'pulse-send-push');

select cron.schedule(
  'pulse-send-push',
  '* * * * *',
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.functions.supabase.co/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body    := '{}'::jsonb
    );
  $$
);
