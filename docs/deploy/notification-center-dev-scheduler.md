# DEV scheduler — Notification Center worker

Immediate kick remains `after()` after each durable enqueue.
Vercel Hobby cron in `vercel.json` is daily (`0 11 * * *`) and is **not** the 1–5 minute recovery path.
Do not claim Preview cron is timely. Do not upgrade the Vercel plan to make it timely.

## Independent 5-minute recovery (preferred)

Use existing Supabase DEV (`yasprgtlqclwsjcshtls`) after review:

1. Enable extensions in the dashboard: `pg_cron`, `pg_net`, `supabase_vault`.
   They were not installed at the time of this review.
2. Store only in Vault (never in git):
   - `notification_worker_url`
   - `notification_worker_secret`
3. Apply `supabase/ops/dev/notification_worker_pg_cron.sql` after recorded approval.
   This file is **not** a product migration.

Expected interval: 5 minutes ± scheduler jitter. This is recovery, not a Meta SLA.

## Optional GitHub Action

`.github/workflows/notification-worker-dev.yml` can ping the same worker when
`NOTIFICATION_WORKER_DEV_ENABLED=true` and the URL/secret repository secrets exist.
Scheduled workflows only run on the default branch, so this stays optional until
Philippe enables it. `workflow_dispatch` works on this branch.

The ping refuses known production hostnames.

## What is already automatic without the scheduler

- Persist event + pending delivery
- `after()` worker kick on the request that created the event
- Daily Hobby cron as last-resort backup

What still needs the 5-minute scheduler: recovery after an interrupted send when
no new quote/payment arrives and no browser/Cursor is open.
