# Notification Center V1.1

**DEV only.** Multi-company. Channel-neutral.

```
BUSINESS EVENT
  → NOTIFICATION EVENT
    → SUBSCRIPTION / RECIPIENT RESOLUTION
      → COMPANY PROVIDER (or DEV env fallback)
        → CHANNEL
          → DELIVERY / AUDIT
```

V1.1 events:

- `quote.created`
- `payment.deposit_received`
- `payment.full_received`

Future catalog rows exist but are disabled:

- `payment.failed`
- `payment.refund_completed`
- `order.confirmed`
- `event.today`
- `event.tomorrow`
- `inventory.low_stock` (only when real thresholds exist)
- `brasinha.action`
- `brasinha.customer_reply`

AI Secretary must consume these same events later. Do not build a parallel engine.

## Recipients vs subscriptions

- `notification_recipients`: person + channel + phone + locale
- `notification_subscriptions`: which events that recipient receives

One phone is not duplicated per event.

## Payment source

Canonical completed payment:

- `recordPaymentAttempt` (PayPal capture + verified webhook)
- `recordManualPayment` (Zelle / bank)

Not PayPal-only. Entity id is `invoice_payments.id`.

Outstanding = `max(invoice.total - invoice.paid_total, 0)`.
Never use `balance_amount` as current remaining balance.

## Providers

`company_notification_providers` + `private.notification_provider_secrets`.
Global `WHATSAPP_*` env is DEV fallback only.

## WhatsApp templates

CODE READY, not META TEMPLATE APPROVED:

- `new_quote_internal`
- `payment_deposit_received_internal`
- `payment_full_received_internal`

Deep links: `/quotes/{id}` or `/invoices/{id}`. Existing auth/RBAC stays enforced.

## Reliability

Quote and payment persistence stay primary.
Enqueue is `void` + try/catch. WhatsApp failure never rolls back money, invoice, or reservation.

Replay without charging:

`node scripts/dev/replay-payment-notification.mjs --payment-id=<uuid> --dry-run`
