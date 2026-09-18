# Pacote de implantação — Notification Center V1.3

**Não aplicar em PROD. Não rebindar o alias DEV oficial.**
Aplicação no Supabase DEV compartilhado somente após revisão Philippe/ChatGPT.

`CURRENT_SHARED_DEV_APPLY_APPROVAL=NOT_GRANTED_FOR_UNCORRECTED_SQL` until the
incremental lineage migration is reviewed. Do not apply V1/V1.2 alone.

## Ordem

1. `supabase/migrations/20260917190000_notification_center_v1.sql`
2. `supabase/migrations/20260918183219_notification_center_v12_auto.sql`
3. `supabase/migrations/20260918213000_notification_center_v13_lineage.sql`

If V1 already exists (`notification_events` present) and V1.2 columns exist,
apply only V1.3. If nothing exists, apply 1 → 2 → 3.

Scheduler SQL is **not** in this product package:
`supabase/ops/dev/notification_worker_pg_cron.sql` (Vault + pg_cron, secrets not in git).

## Preflight

```
npm run preflight:dev:notification-center-v12
```

- Target ref = `yasprgtlqclwsjcshtls` only
- PROD ref must be rejected
- Confirm no phone numbers / QA UUIDs / Caio in any of the three SQL files
- Record `sha256sum` of the three files in the review comment

## After apply

```
select event_key, v1_enabled from notification_event_definitions
  where event_key in ('quote.created','quote.accepted','payment.deposit_received','payment.full_received');

select column_name from information_schema.columns
  where table_name='notification_deliveries'
    and column_name in ('next_attempt_at','result_state','claimed_at','send_attempted_at','queue_eligible');

select conname from pg_constraint
  where conname in (
    'notification_subscriptions_recipient_tenant_fkey',
    'notification_deliveries_event_tenant_fkey',
    'notification_deliveries_recipient_tenant_fkey',
    'notification_recipients_person_tenant_fkey'
  );

select grantee, privilege_type
  from information_schema.role_table_grants
  where table_name in ('notification_events','notification_deliveries')
    and grantee = 'authenticated';
```

Authenticated must have SELECT only on events/deliveries.

Positive/negative lineage (throwaway companies, never CDL phones):

```
-- same-company subscription/delivery/person link: success
-- company A recipient on company B subscription: reject
-- company A event on company B delivery: reject
-- company A recipient with company B person: reject
```

## Rollback

V1.3 is additive constraints/grants/columns. Safe rollback after review:

```
-- drop new composite FKs and queue_eligible/send_attempted_at only if unused
-- restore previous grants only after review
-- do not drop V1 notification tables
-- do not delete recipients, events, or delivery history
```

## Worker cadence

Immediate dispatch is `after()` after each durable enqueue.
`vercel.json` cron is daily (`0 11 * * *`) so Preview can deploy on Hobby.
5-minute recovery: see `docs/deploy/notification-center-dev-scheduler.md`.

Replay: `npm run replay:dev:payment-notification -- --payment-id=<uuid> --dry-run`
