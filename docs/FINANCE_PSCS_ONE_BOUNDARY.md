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
- At most one non-canceled invoice exists per company/quote.
- The invoice stores a frozen commercial snapshot of the quote/event/customer/pricing state.
- Payment attempts are separate records linked to the invoice.
- `paid_total` and invoice status are derived from completed payments by the server payment flow.
- Public/browser code must never own the payable amount or currency.
- Payment links never expose their token hash in authenticated list/detail views.
- Tenant/company authorization must be resolved before server reads.
- Financial child records are protected by composite tenant-consistency constraints in DEV, so a payment/link/hold cannot reference a parent belonging to another company.
- PROD and PayPal Live remain outside the current DEV/Sandbox scope.

## Resolved in this DEV iteration

1. **Finance read authorization.** `finance.invoices.view` is now an explicit permission for owner/admin/sales/finance. Invoice, payment and payment-link SELECT RLS policies use that permission, and invoice APIs/PDF are protected by it.
2. **Company consistency at the database layer.** Composite company/parent foreign keys now enforce tenant consistency across invoices, payments, payment links and schedule holds. Pre-migration mismatch checks returned zero invalid relationships.
3. **Payment-link vs invoice balance clarity.** The public payment page now shows the actual invoice outstanding amount separately from the amount still due for the specific payment request. A completed deposit link no longer implies that a partially paid invoice is fully paid.

## Gaps to close before a production financial ledger integration

### P0 — correctness / money movement

1. **Refund lifecycle is not modeled yet.** The current payment status vocabulary ends at completed/failed/canceled. A captured payment later refunded needs a first-class refund record or append-only financial event; changing the original completed payment to canceled would destroy settlement history.
2. **Cancellation after capture needs rules.** An invoice with captured money cannot be treated as a simple cancellation. Refund/credit handling and reservation release must be coordinated and auditable.
3. **Concurrent capture reconciliation.** `invoices.paid_total` is a denormalized aggregate. The capture path is idempotent, but the optimistic aggregate update should gain a reconciliation/retry path (or transactional/RPC locking) before high-volume production use so a rare concurrent update cannot leave a completed payment ahead of the invoice aggregate.

### P1 — operational finance

4. **Manual methods need reconciliation workflow.** Zelle and bank transfer need explicit evidence/confirmation, actor, timestamp and audit trail before they increase `paid_total`; provider settings alone are not payment reconciliation.
5. **Provider fees/settlements are separate from customer amount.** `online_payment_fee` is intentionally fixed at zero in V1. Provider processing fees and net settlement should be modeled later for reconciliation/DRE without changing what the customer owed.
6. **Due dates/installments are not represented.** Current purposes are deposit/balance/full. If CDL needs due dates, installment schedules, aging or overdue states, add a receivable schedule instead of overloading invoice status.

### P1 — PSCS One handoff

7. **Outbox/export state is not present yet.** Add it only when PSCS One has a receiving contract; do not create speculative cross-product tables now.
8. **Accounting mapping is not present yet.** Account/category/cost-center mapping belongs in the shared financial layer or an explicit integration mapping, not in the Catering quote snapshot.
9. **Reprocessing/observability is required.** Export failures must be visible and retryable without duplicating financial effects.

## Security review of the current DEV foundation

The financial tables inspected in DEV (`invoices`, `invoice_payments`, `invoice_payment_links`, `payment_schedule_holds`) have RLS enabled. Invoice, payment and payment-link reads require the explicit finance permission. Invoice and payment-link client writes remain restricted by their existing write policies; payment attempts do not expose a general authenticated client write policy. Schedule holds are RLS-enabled and are expected to be managed by controlled server logic.

Authenticated Finance pages still perform application authorization because server-side service-role reads bypass RLS. The backoffice routes resolve the authorized company from the authenticated session and check the finance permission before querying. Invoice detail, invoice PDF and quote-to-invoice read APIs use the same finance boundary.

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
