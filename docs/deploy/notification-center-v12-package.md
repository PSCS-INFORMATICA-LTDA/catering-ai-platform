# Pacote de implantação — Notification Center V1.2

**Não aplicar em PROD. Não rebindar o alias DEV oficial.**
Aplicação no Supabase DEV compartilhado somente após revisão Philippe/ChatGPT.

## Ordem

1. `supabase/migrations/20260917190000_notification_center_v1.sql`
2. `supabase/migrations/20260918183219_notification_center_v12_auto.sql`

Se a V1 já existir (`notification_events` presente), aplicar somente a V1.2.

## Preflight

- Target ref = `yasprgtlqclwsjcshtls` only
- PROD ref must be rejected
- Confirm `notification_event_definitions` / `notification_deliveries` exist or V1 will create them
- Confirm no phone numbers / QA UUIDs in either file
- `sha256sum` the two SQL files and record in the review comment

## After apply

```
select event_key, v1_enabled from notification_event_definitions
  where event_key in ('quote.created','quote.accepted','payment.deposit_received','payment.full_received');
select column_name from information_schema.columns
  where table_name='notification_deliveries'
    and column_name in ('next_attempt_at','result_state','claimed_at');
select column_name from information_schema.columns
  where table_name='notification_recipients' and column_name='consent_status';
```

## Rollback

V1.2 is additive. Safe rollback is:

```
-- only if V1.2 was the last change and no production traffic used it
-- drop new columns/table after review; do not drop V1 notification tables
```

Do not delete recipients, events, or delivery history.

## External Meta checklist (not in this package)

- App Secret in `WHATSAPP_APP_SECRET` (server-only)
- Callback URL: `{preview}/api/notifications/whatsapp/status`
- Verify token + signature
- Templates + languages still external
- Shared sender allowlist if using platform credentials

Replay: `npm run replay:dev:payment-notification -- --payment-id=<uuid> --dry-run`
