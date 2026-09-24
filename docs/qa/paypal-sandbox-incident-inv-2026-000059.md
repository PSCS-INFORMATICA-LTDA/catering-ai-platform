# PayPal Sandbox incident — INV-2026-000059 (USD 555.30)

Status: **diagnosed, NOT corrected**. The correction below requires explicit
approval from Philippe before it is executed. Nothing in this document has been
applied to any database.

Environment: DEV Supabase project `yasprgtlqclwsjcshtls` (the database behind
`catering-ai-agenda-dev.vercel.app`, a Vercel **Preview** alias of
`feat/public-self-service-quote-dev`). No Production data was read or changed.

## Root cause

- `sandboxRuntimeAllowed()` allowed the public `/pay/[token]` checkout to run the
  PayPal **Sandbox** SDK on Vercel Preview.
- The capture route recorded the Sandbox capture as `invoice_payments.status =
  'completed'`, which is the only status the ledger treats as money received.
- That cascaded: `reconcile_invoice_ledger` set `paid_total = 555.30`,
  `confirmPaidDepositReservation` confirmed the reservation, converted the quote
  into a service order, scheduled the agenda event, consumed the schedule hold,
  and the `finance_payment_outbox` trigger queued `payment.completed` for PSCS One.
- Three PayPal orders were created for the same deposit because
  `paymentLinkId` was part of the PayPal-Request-Id; three different links for
  the same invoice produced three distinct orders.

## Positively identified records (read-only diagnostic, 2026-09-24)

| Entity | Identifier | State found |
| --- | --- | --- |
| Company | `65fd576f-8d97-49ba-bf38-61bc1e94e94a` (CDL) | — |
| Invoice | `INV-2026-000059` / `f953f2b8-dc7f-47ad-a55f-a5d0c691d4c5` | total 1851.00, deposit 555.30, `paid_total` 555.30, `partially_paid` |
| Quote | `Q-2026-000328` / `3839e3bb-709c-4138-8335-5e935e9463c6` | `quote_status = converted`, `reservation_confirmed_at = 2026-09-24T19:13:45.639Z` |
| Service order | `8285d5b7-316e-4db8-a727-6e5dbf17d193` | `planned` |
| Agenda event | `d9285d87-5697-4590-bdf3-6a5207734de7` | `scheduled`, 2026-10-10 |
| Schedule hold | `11d6a953-81f7-4cf4-9d56-39de50d33c12` | `consumed` |
| Payment (captured) | `4b9509c2-1a50-4652-9c2c-efbb01bd78c3` | `completed`, order `53A00749WC447272R`, capture `0M2841996G610524K`, no environment stamp |
| Payment (orphan) | `af93041d-…` order `1TM68787G6710735W` | `created` |
| Payment (orphan) | `4c213f0f-…` order `2TC91880TN9953200` | `created` |
| Outbox | `0cbb6648-aafa-40cd-99a2-56f042482aca` | `payment.completed`, **pending** (not published) |

## Diagnostic SQL (SELECT only)

```sql
-- 1. Invoice
SELECT id, invoice_number, status, total, deposit_amount, paid_total,
       quote_id, service_order_id, currency_code
FROM public.invoices
WHERE company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
  AND invoice_number = 'INV-2026-000059';

-- 2. PayPal attempts for the invoice
SELECT id, status, purpose, amount, currency_code, provider_order_id,
       provider_capture_id, captured_at, created_at,
       metadata->>'environment' AS environment,
       metadata->>'test_transaction' AS test_transaction
FROM public.invoice_payments
WHERE company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
  AND invoice_id = 'f953f2b8-dc7f-47ad-a55f-a5d0c691d4c5'
  AND provider = 'paypal'
ORDER BY created_at;

-- 3. Quote / service order / agenda / hold
SELECT id, quote_number, quote_status, reservation_confirmed_at,
       converted_service_order_id
FROM public.quotes
WHERE id = '3839e3bb-709c-4138-8335-5e935e9463c6';

SELECT id, status, quote_id, event_id
FROM public.service_orders
WHERE id = '8285d5b7-316e-4db8-a727-6e5dbf17d193';

SELECT id, status, event_date, quote_id, service_order_id
FROM public.agenda_events
WHERE service_order_id = '8285d5b7-316e-4db8-a727-6e5dbf17d193';

SELECT id, status, consumed_at, released_at, release_reason
FROM public.payment_schedule_holds
WHERE invoice_id = 'f953f2b8-dc7f-47ad-a55f-a5d0c691d4c5';

-- 4. Outbox
SELECT id, event_type, status, aggregate_id, published_at, last_error
FROM public.finance_integration_outbox
WHERE company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
  AND aggregate_id IN ('4b9509c2-1a50-4652-9c2c-efbb01bd78c3',
                       'f953f2b8-dc7f-47ad-a55f-a5d0c691d4c5');

-- 5. Any other un-stamped PayPal "completed" rows (possible Sandbox leaks)
SELECT company_id, invoice_id, id, amount, captured_at
FROM public.invoice_payments
WHERE provider = 'paypal'
  AND status = 'completed'
  AND COALESCE(metadata->>'environment', '') <> 'live';
```

## Proposed correction — NOT APPLIED, requires approval

Reclassify the capture as a Sandbox TEST transaction using the same shape the
hotfix now writes (`status = 'approved'` plus Sandbox metadata). IDs are kept for
audit. `completed -> approved` does not enqueue a new outbox event.

```sql
BEGIN;

-- a) Payment: keep order/capture IDs, mark TEST, remove from the ledger.
UPDATE public.invoice_payments
SET status = 'approved',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'environment', 'sandbox',
      'test_transaction', true,
      'sandbox_capture', jsonb_build_object(
        'source', 'incident_correction',
        'order_id', '53A00749WC447272R',
        'capture_id', '0M2841996G610524K',
        'status', 'COMPLETED',
        'amount', 555.30,
        'currency', 'USD',
        'recorded_at', now()
      )
    ),
    updated_at = now()
WHERE id = '4b9509c2-1a50-4652-9c2c-efbb01bd78c3'
  AND company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
  AND status = 'completed'
  AND provider_capture_id = '0M2841996G610524K';
-- expect: UPDATE 1

-- b) Invoice ledger back to paid_total 0 / awaiting_deposit.
SELECT public.reconcile_invoice_ledger(
  '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
  'f953f2b8-dc7f-47ad-a55f-a5d0c691d4c5'
);

-- c) Keep the queued payment.completed from reaching PSCS One.
UPDATE public.finance_integration_outbox
SET status = 'failed',
    last_error = 'sandbox_test_transaction_not_financial',
    updated_at = now()
WHERE id = '0cbb6648-aafa-40cd-99a2-56f042482aca'
  AND status = 'pending';

-- Verify before COMMIT; default is ROLLBACK.
ROLLBACK;
```

Decisions that need Philippe/Caio before the operational rows are touched (not
scripted on purpose):

1. Quote `Q-2026-000328`: revert `quote_status` from `converted` to its
   pre-conversion value and clear `reservation_confirmed_at` /
   `converted_service_order_id`, or keep the booking and collect the deposit by
   Zelle/bank transfer.
2. Service order `8285d5b7-…` and agenda event `d9285d87-…` (2026-10-10): cancel
   them or keep the date held while a real deposit is collected.
3. Contact the customer: no real money moved (Sandbox), so there is nothing to
   refund. Ask them to pay the 555.30 deposit through an available method.
4. Confirm with PSCS One that an outbox row in `failed` status is never
   republished.
