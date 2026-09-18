-- DEV scheduler for /api/notifications/worker — REVIEW ONLY.
-- Never apply to Production. Never put secrets in this file.
-- Extensions are not assumed installed. Enable them in the Supabase DEV dashboard first.
-- Target project ref: yasprgtlqclwsjcshtls
--
-- 1) Dashboard > Database > Extensions: enable pg_cron, pg_net, supabase_vault.
-- 2) Dashboard > Project Settings > Vault: create two secrets:
--      notification_worker_url    = Preview or DEV worker URL (https://.../api/notifications/worker)
--      notification_worker_secret = same value as NOTIFICATION_WORKER_SECRET / CRON_SECRET
--    Do not paste those values into git, chat, or this SQL.
-- 3) After review/approval, run this file on DEV only.

do $$
begin
  if current_setting('app.settings.block_prod', true) = 'on' then
    raise exception 'refused_prod';
  end if;
end
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'notification-worker-dev-5min') then
    perform cron.unschedule('notification-worker-dev-5min');
  end if;
end
$$;

select cron.schedule(
  'notification-worker-dev-5min',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'notification_worker_url'
      limit 1
    ),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'notification_worker_secret'
        limit 1
      ),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('reason', 'pg_cron_dev')
  );
  $cron$
);

comment on extension pg_cron is
  'DEV recovery ping every 5 minutes. Does not prove Meta delivery time.';
