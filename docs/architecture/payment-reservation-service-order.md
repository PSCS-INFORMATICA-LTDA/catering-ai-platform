# Payment → reservation → service order

**DEV only.** Provider-neutral. No PayPal Live. No remote PSCS One FK.

## Architecture found

Before this change the stack already had three canonical pieces:

1. **Payment completed** — PayPal capture/webhook and Zelle/manual reconciliation write `invoice_payments` and reconcile `invoices.paid_total`.
2. **Reservation confirmed** — `confirmPaidDepositReservation` / `confirmQuoteDepositAndReserveSchedule` set `quotes.reservation_confirmed_at` and upsert one `agenda_events` row (`uq_agenda_events_quote_active`).
3. **Quote → OS** — `convertAcceptedQuoteToServiceOrder` is the existing idempotent conversion (`quotes.converted_service_order_id` + unique `(company_id, quote_version_id)`).

The gap: OS conversion stayed a manual operator action (`POST /api/quotes/:id/convert`). PayPal/Zelle confirmed the reservation and left the agenda reserved without an OS.

## Rule now

```
PAYMENT COMPLETED
  → RESERVATION CONFIRMED
  → ENSURE SERVICE ORDER
```

PayPal only confirms money. The same `confirmPaidDepositReservation` transition is used by:

- PayPal capture
- PayPal webhook
- `recordPaymentAttempt`
- Zelle / bank manual payment

It reuses `convertAcceptedQuoteToServiceOrder`. It does not insert a second OS implementation.
An inactive quote returns `quote_inactive` and never creates an OS.

## Idempotency

- Reservation: update only when `reservation_confirmed_at IS NULL`
- Agenda: unique active `(company_id, quote_id)`
- OS: unique `(company_id, quote_version_id)` + `quotes.converted_service_order_id`
- Refresh / webhook / retry / double-click return the same OS (`already_existed: true`)
- `recordPaymentAttempt` calls `ensurePaidContractAdvance` on every completed path (idempotency, provider-order, race after update/insert, normal complete) and returns `readRecordedPaymentClose`
- Money can stay `financialCompleted=true` while OS/agenda is `operationalAdvanceCompleted=false`
- A failed OS/agenda returns `paid_contract_ensure_failed`. It does not swallow with `.catch(() => null)` and never undoes the payment
- Webhook returns `503` when `operationalAdvanceCompleted === false` so PayPal retries the same capture
- Duplicate capture, webhook `503`, Zelle, and Commercial Review page load retry the same ensure

At most one operational reservation and one canonical OS per contract.

## Financial states

| State | Reservation | OS |
| --- | --- | --- |
| Accepted, unpaid | no | no |
| Deposit paid | yes | ensure same OS |
| Paid in full | yes | same OS |
| Balance after deposit | no new reservation | same OS |
| Post-event adjustment | no | no second OS |
| Payment failed | no | no |

## Audit reused

`audit_logs` via `writeOperationalAudit`:

- `payment_completed`
- `reservation_confirmed`
- `service_order_created`
- `service_order_ensure_failed`
- `agenda_ensure_failed`

plus the existing `convert_quote_to_service_order`.

## Future Brasinha / PSCS One

Stable IDs stay in-domain: company, customer, quote, quote_version, invoice, payment, reservation, service_order. No remote FK in this PR.

## Commercial Review

`ContractLifecycleCard` shows the real lifecycle. Reservation is never shown as confirmed before the deposit is financially satisfied. A paid reservation without an OS shows **Ordem de Serviço pendente de geração** and the Commercial Review server load retries the ensure once.
