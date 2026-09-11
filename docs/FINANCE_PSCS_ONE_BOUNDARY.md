# Catering AI Finance boundary → PSCS One

Status: DEV architecture decision for the current invoice/payment foundation.

## Decision

Catering AI remains the system of record for the **operational commercial lifecycle** of an event:

`Quote → acceptance → invoice snapshot → payment request/attempt → payment capture → reservation/agenda → service order`

The authenticated Finance module in Catering is therefore an **operational receivables view**, not a general ledger. It must continue to show the invoice and payment state needed by sales, operations and finance users even after PSCS One integration exists.

PSCS One should become the shared financial/accounting consolidation layer for capabilities that span products or companies, including:

- accounts receivable/payable consolidation;
- bank/provider reconciliation;
- cash position and cash flow;
- DRE/P&L and accounting classifications;
- payment-provider fees and settlement reconciliation;
- taxes/fiscal/accounting integrations;
- multi-company financial reporting and shared governance.

Do **not** move the Catering quote/event snapshot into PSCS One as the only copy. The invoice snapshot is evidence of the commercial state that produced the receivable and must remain traceable inside Catering.

## Integration contract

Avoid direct cross-database foreign keys between Catering AI and PSCS One. Integrate using versioned business events/outbox records with stable source identifiers and idempotency.

Minimum event vocabulary for the future shared layer:

- `invoice.created`
- `invoice.canceled`
- `payment.completed`
- `payment.failed`
- `payment.refunded`
- `invoice.paid`

Each exported event should carry at least:

- source product (`catering_ai`);
- company/tenant identifier;
- source invoice ID and invoice number;
- source quote ID and quote number where relevant;
- payment ID/provider reference where relevant;
- currency and monetary amounts;
- occurrence timestamp;
- event schema version;
- idempotency/event ID.

PSCS One must acknowledge/store the source reference so retries cannot duplicate accounting/financial effects.

## Current Catering invariants

- An active invoice is company-scoped and linked to one quote.
- The invoice stores a frozen commercial snapshot of the quote/event/customer/pricing state.
- Payment attempts are separate records linked to the invoice.
- `paid_total` and invoice status are derived from completed payments by the server payment flow.
- Public/browser code must never own the payable amount or currency.
- Payment links never expose their token hash in authenticated list/detail views.
- Tenant/company authorization must be resolved before server reads.
- PROD and PayPal Live remain outside the current DEV/Sandbox scope.

## Gaps to close before a production financial ledger integration

### P0 — correctness / money movement

1. **Refund lifecycle is not modeled yet.** The current payment status vocabulary ends at completed/failed/canceled. A captured payment later refunded needs a first-class refund record or append-only financial event; changing the original completed payment to canceled would destroy settlement history.
2. **Cancellation after capture needs rules.** An invoice with captured money cannot be treated as a simple cancellation. Refund/credit handling and reservation release must be coordinated and auditable.
3. **Concurrent capture reconciliation.** `invoices.paid_total` is a denormalized aggregate. The capture path must remain idempotent and should be periodically reconciled against completed payment records; database transaction/RPC locking should be considered before high-volume production use.
4. **Company consistency at the database layer.** Child rows currently have independent `company_id` and `invoice_id` foreign keys. Application queries scope both, but a future migration should enforce that a payment/link/hold cannot reference an invoice from a different company (for example via a composite unique key + composite FK or equivalent trigger/constraint).

### P1 — operational finance

5. **Manual methods need reconciliation workflow.** Zelle and bank transfer need explicit evidence/confirmation, actor, timestamp and audit trail before they increase `paid_total`; provider settings alone are not payment reconciliation.
6. **Provider fees/settlements are separate from customer amount.** `online_payment_fee` is intentionally fixed at zero in V1. Provider processing fees and net settlement should be modeled later for reconciliation/DRE without changing what the customer owed.
7. **Due dates/installments are not represented.** Current purposes are deposit/balance/full. If CDL needs due dates, installment schedules, aging or overdue states, add a receivable schedule instead of overloading invoice status.
8. **Payment-link state vs invoice balance must be explicit.** A deposit link can have `amount due = 0` while the invoice is still partially paid. UI must distinguish “this payment request is satisfied” from “the invoice is fully paid.”

### P1 — PSCS One handoff

9. **Outbox/export state is not present yet.** Add it only when PSCS One has a receiving contract; do not create speculative cross-product tables now.
10. **Accounting mapping is not present yet.** Account/category/cost-center mapping belongs in the shared financial layer or an explicit integration mapping, not in the Catering quote snapshot.
11. **Reprocessing/observability is required.** Export failures must be visible and retryable without duplicating financial effects.

## Security review of the current DEV foundation

The financial tables inspected in DEV (`invoices`, `invoice_payments`, `invoice_payment_links`, `payment_schedule_holds`) have RLS enabled. Invoice and payment-link client writes are restricted to admin/owner policies; payment attempts do not expose an authenticated client write policy. Schedule holds are RLS-enabled without a general client policy and are expected to be managed by controlled server logic.

Authenticated Finance pages must still perform application authorization because server-side service-role reads bypass RLS. The new backoffice route therefore resolves the authorized company from the authenticated session and checks a finance permission before querying.

## Scope of the current Finance module

The first Finance module is deliberately read-only:

- invoice list and filters;
- invoice → source quote traceability;
- customer/event snapshot;
- total, deposit, paid total and actual invoice outstanding balance;
- payment-attempt history;
- payment-link history without token material;
- PDF access;
- bidirectional navigation between quote and invoice.

Mutating functions such as manual payment posting, refunds, write-offs, credits, reconciliation and accounting exports must be introduced as separate audited capabilities with their own permissions and production gates.
