# Catering AI Finance boundary → PSCS One

Status: DEV architecture + implemented operational finance foundation on PR #43.

## Decision

Catering AI remains the system of record for the **operational commercial lifecycle** of a catering event:

`Quote → acceptance → invoice snapshot → payment request/attempt → capture/reconciliation → reservation/agenda → service order → cancellation/refund when needed`

The authenticated Finance module in Catering is therefore an **operational receivables module**, not the corporate general ledger. It must remain available even after PSCS One integration so Sales, Operations and Finance can determine what the customer owes, what was received/refunded, and whether the event may remain reserved.

PSCS One should become the shared financial/accounting consolidation layer for cross-product or cross-company capabilities:

- consolidated accounts receivable/payable;
- bank, PayPal, Zelle and settlement reconciliation;
- provider fees and net settlement;
- cash position and cash flow;
- DRE/P&L and accounting classifications;
- tax/fiscal/accounting integrations;
- cost centers and multi-company financial reporting;
- shared financial governance and observability.

Do **not** move the Catering quote/event/invoice snapshot into PSCS One as the only copy. The invoice snapshot is immutable commercial evidence of the state that generated the receivable.

## Integration contract

There are no direct cross-database foreign keys between Catering AI and PSCS One. DEV now contains a durable, idempotent `finance_integration_outbox` with retry/claim primitives. Network delivery is intentionally **not enabled** until PSCS One exposes and approves a receiving contract.

Current event vocabulary:

- `invoice.created`
- `invoice.canceled`
- `payment.completed`
- `payment.failed`
- `payment.refunded`
- `invoice.paid`

Events carry source product, company, aggregate/source IDs, currency/amounts, occurrence time, schema version and stable de-duplication key. PSCS One must persist source event/reference IDs so retries cannot duplicate accounting effects.

## Current Catering financial invariants

- Every invoice is company-scoped and linked to its source quote.
- Financial child records use tenant-consistency foreign keys where applicable.
- The invoice stores a frozen commercial snapshot of quote/event/customer/pricing state.
- Payment attempts/captures remain separate append-only evidence.
- A refund is a separate financial movement; a completed capture is never rewritten as canceled.
- `paid_total` is the net of completed payments minus completed refunds.
- Browser-supplied payable amounts/currency are discarded; payable amount is server-owned.
- Payment links never expose token hashes in the backoffice.
- Manual Zelle/bank receipts require confirmation reference, actor, timestamp and audit evidence.
- Refund amount is reserved/validated transactionally against the original completed payment to prevent over-refund races.
- Invoice or Service Order cancellation revokes payment links/releases holds and releases the agenda; captured money moves the financial cancellation to `pending_refund` rather than deleting history.
- A Service Order cancellation is now the operational owner after quote conversion and coordinates the linked receivable in one database transaction.
- PayPal Live and PROD remain outside this DEV/Sandbox stream.

## Implemented in this DEV iteration

### Invoice backoffice and traceability

`Financeiro → Faturas` provides company-scoped invoice list/detail, source quote, customer/event snapshot, totals, received amount, real invoice outstanding amount, payment history, payment-link history, refunds, cancellations and PDF/navigation.

The public payment view distinguishes **invoice outstanding balance** from **amount due on the current payment link**, so a paid deposit link no longer makes a partially paid invoice appear fully paid.

### Authorization and tenant integrity

Explicit capabilities exist for:

- `finance.invoices.view`
- `finance.payments.reconcile`
- `finance.refunds.manage`
- `finance.invoices.cancel`

Finance reads/writes are company-scoped. Sensitive finance RPCs are service-role only. Composite parent/company constraints prevent cross-tenant invoice/payment/link/hold relationships.

### Manual receipt reconciliation

Zelle and bank transfer can be posted only after an authorized operator confirms external receipt evidence. `record_manual_invoice_payment` owns amount calculation, idempotency, ledger update and outbox creation atomically. Deposit satisfaction then synchronizes the reservation idempotently.

### Refund lifecycle

`invoice_refunds` is first-class append-only financial evidence. Refund requests lock the captured payment while calculating the remaining refundable amount, preventing concurrent over-refund.

Completion recalculates the invoice net ledger and can close a pending cancellation when net received reaches zero.

For PayPal **Sandbox only**, an authorized finance user can execute the requested refund against the original capture using `/v2/payments/captures/{capture_id}/refund`. Amount/currency are server-owned and a deterministic PayPal request id protects retries. `PENDING` is preserved as processing rather than falsely shown as completed.

Verified `PAYMENT.CAPTURE.REFUNDED` webhooks reconcile PayPal refunds, including refunds initiated externally in the Sandbox dashboard. The webhook path verifies PayPal signature before the service-role reconciliation RPC runs.

Zelle/bank refunds remain external money movement: the operator performs the return outside Catering and records the verified reference only after completion.

### Cancellation coordination

Before Service Order conversion, invoice cancellation atomically:

- revokes active payment links;
- releases checkout capacity holds;
- releases unconverted agenda reservation;
- creates an auditable invoice cancellation;
- cancels immediately only when net received is zero;
- otherwise leaves the cancellation `pending_refund`.

After Service Order conversion, the OS is the operational owner. `cancel_service_order_with_finance` atomically cancels the OS and agenda and coordinates the linked invoice cancellation. It **does not automatically move money**; if net received is positive, an authorized finance user must refund/confirm the return.

### PSCS One outbox

`finance_integration_outbox` provides durable event state, stable de-duplication, claim with `SKIP LOCKED`, retry availability and success/failure completion primitives. This is the handoff seam to PSCS One; the delivery worker remains disabled until the receiving API/contract exists.

## DEV QA evidence

Rollback-only database QA has exercised the critical ledger transitions without leaving synthetic rows:

- manual bank receipt → invoice aggregate + `payment.completed` outbox → rollback;
- refund request/idempotency/completion → net ledger + `payment.refunded` outbox → rollback;
- verified PayPal refund reconciliation → net ledger + refund outbox → rollback;
- unpaid invoice cancellation → canceled invoice + links revoked → rollback;
- converted Service Order cancellation with a paid deposit → OS and agenda canceled + invoice `pending_refund` + links revoked → rollback.

Post-rollback checks confirmed the original DEV payment/invoice/agenda/order state and zero QA rows remained.

## Database/platform hardening completed

- `inventory_document_sequences` now has RLS enabled and direct client grants removed; it is intentionally internal/service-role state.
- Sensitive internal inventory/document RPCs have explicit least-privilege execution grants.
- public token RPCs no longer inherit PostgreSQL's implicit `PUBLIC EXECUTE`; explicit `anon/authenticated/service_role` grants exist only for intentional high-entropy token flows.
- key public views use `security_invoker` where required.
- finance foreign-key hot paths have covering indexes.
- payment links now include `updated_at` so revocation/cancellation mutations have modification timestamps.

## Remaining pre-PROD gates

These are not reasons to duplicate the Finance module in PSCS One; they are production-readiness gates:

1. **Authenticated UI E2E with CDL users.** Validate invoice detail, manual receipt, refund request, PayPal Sandbox refund, cancellation messages and permissions on desktop/mobile.
2. **PayPal Sandbox refund E2E.** Execute one controlled refund in Sandbox and verify provider refund → verified webhook/direct response → `invoice_refunds` → invoice net ledger → audit/outbox. This is the only remaining money-provider test and still moves no real money.
3. **Existing PayPal webhook subscription.** New webhook registrations request capture + refund events. Existing company webhooks are not silently modified; configure/update the existing CDL Sandbox webhook during QA if its subscription does not yet include refund events.
4. **Supabase Auth leaked-password protection.** Security advisor reports it disabled. Enable it in project Auth settings before PROD; this is project configuration rather than application SQL.
5. **Platform performance backlog.** Supabase still reports legacy unindexed FKs, duplicate indexes and multiple permissive RLS policies outside the finance-critical path. Do not mass-create/drop indexes without workload/query-plan evidence; resolve by hot path before production load.
6. **PSCS One receiver.** Define endpoint/auth/schema-version/acknowledgement/replay policy before enabling the outbox delivery worker.
7. **Corporate finance features.** Provider settlement/fees, AP, cash flow, DRE, accounting/fiscal mappings and consolidated reporting belong to PSCS One rather than this Catering operational ledger.
8. **Receivable schedules if required.** Deposit/balance/full are supported. Aging, arbitrary installments and due-date schedules should be a separate receivable schedule model if CDL adopts them.

## Production gate

PR #43 must remain DEV/Sandbox until authenticated QA is accepted. No PayPal Live credentials, Live checkout or PROD migration is authorized by this document.
