# Notification Center V1

**DEV only.** Multi-company. Channel-neutral.

```
BUSINESS EVENT
  → NOTIFICATION EVENT
    → RECIPIENT RESOLUTION
      → CHANNEL PROVIDER
        → DELIVERY / AUDIT
```

V1 event: `quote.created`
V1 channel: `whatsapp` (Meta Cloud API behind `NotificationProvider`)

Future channels reuse the same events:

- `web_push`
- `email`
- `in_app`
- AI Secretary

Do not build a parallel communication engine.

## Idempotency

- `notification_events` unique `(company_id, event_key, entity_id)`
- `notification_deliveries` unique `idempotency_key`
  = `company + event + entity + recipient + channel`

Refresh, retry, and duplicate public submit reuse the same event and delivery.

## Reliability

Quote persistence is the primary transaction. Enqueue is `void` + try/catch.
A WhatsApp failure never rolls back the quote. Failed rows stay retryable.

## Recipients

Configured per company in `/settings/notifications`.
Phone numbers are not hardcoded. Delivery uses E.164; `phone_raw` is preserved.

## WhatsApp template

Code is ready for semantic template `new_quote_internal`.

```
🔥 Nova cotação recebida
Cliente: {{customer_name}}
Evento: {{event_date}} {{event_time}}
Cotação: {{quote_number}}
Total: {{quote_total}}
Button: Ver cotação → /quotes/{quote_id}
```

`CODE READY` is not `META TEMPLATE APPROVED`. External Meta approval is a gate.

## Security

All tables have `company_id` + RLS via `private.has_permission`.
Deep links require the existing quote RBAC. No unauthenticated quote URLs.
Secrets stay server-side (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).
