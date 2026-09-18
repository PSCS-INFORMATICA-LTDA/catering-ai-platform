# Notification Center V1.2

**DEV only.** Multi-company. Channel-neutral.

```
CONFIRMED BUSINESS TRANSITION
  → DURABLE notification_events + notification_deliveries
    → after() worker kick + daily Hobby cron + optional 5-min DEV scheduler
      → COMPANY PROVIDER (no silent global fallback)
        → WhatsApp Cloud API
          → delivery history / Meta callback
```

V1.2 events:

- `quote.created`
- `quote.accepted` (accepted version actually persisted)
- `payment.deposit_received`
- `payment.full_received` (only when the invoice is fully paid)

Acceptance is not payment. Payment is not a confirmed reservation.
`purpose=full` without a settled invoice does **not** emit quitação.

Outstanding = `max(invoice.total - invoice.paid_total, 0)`. Never `balance_amount`.

## Automatic worker

Persist is durable. Meta is never called inside the financial transaction.
`recordPayment` / proposal accept / quote create stay `void enqueue*Safe`.
`enqueueEvent` writes pending deliveries and schedules `after()` → `processNotificationQueue`.
Cron backup: `GET/POST /api/notifications/worker` daily at 11:00 UTC on Hobby
(`0 11 * * *`). Immediate send uses `after()` after each persist.
5-minute recovery uses Vault + pg_cron/pg_net on DEV (reviewed separately) or an optional GitHub ping. Not a Vercel plan upgrade.

Retries: limited backoff. Exhausted failed rows are excluded before LIMIT (`queue_eligible`).
Stuck `processing` without `send_attempted_at` / `provider_message_id` returns to pending.
Stuck `processing` after a possible Meta accept is quarantined as `uncertain` and is not resent blindly.
Timeout after calling Meta → `uncertain`. Manual retry is optional and still requires confirmed consent.

Activation watermark: `company_notification_settings.auto_dispatch_from`.
No automatic backfill of old payments. Replay remains explicit and DEV-only.

## Security

- WhatsApp POST verifies `X-Hub-Signature-256` on the raw body with the App Secret.
- GET verify token does not authorize POST.
- Updates are scoped by company + `phone_number_id` / WABA.
- Status never regresses `read` → `sent`.
- Callback never changes financial state.
- Disabled provider or decrypt failure does not fall back to global credentials.
- Shared sender requires `WHATSAPP_SHARED_SENDER_COMPANY_IDS` or `provider=pscs_shared`.

## Recipients

Consent starts as `unknown`. Only `consent_status = confirmed` is sendable.
`null`, `unknown`, and `denied` block worker, test, retry, and dispatch.
Do not invent consent. Phone lives on the notification recipient, not PayPal.

## Screens

- `/settings/notifications` — recipients, events, diagnosis, controlled test
- `/settings/payments` — shortcut “Notificações de pagamento”
- `/activities` — summary / transactions / WhatsApp (financial ledger stays on invoices)

CODE READY, not META TEMPLATE APPROVED.

DEV schema: combined history row `20260918221541` / `notification_center_v1_v12_v13_reviewed_dev`. Do not reapply the three source files.

PSCS One contract (no second registry): `docs/integration/pscs-one-notification-readiness.md`.
Shared sender is PSCS-managed. Tenant IDs are mapped, never assumed equal.
