# Commercial Review / Proposal Workspace V1

**Status:** DEV stacked development. Not merged. Not production. Approval remains Philippe’s.
**Branch:** `feat/commercial-review-workspace-v1-dev`
**Base:** `feat/coupon-center-v1-dev-v2` (PR #48). Do not merge #48 from this work. Do not put these commits on #48.
**Environment:** DEV only (`yasprgtlqclwsjcshtls`)
**Official DEV alias:** do not rebind `catering-ai-agenda-dev.vercel.app` in this round.

## Stacked strategy

Coupon Center still awaits Philippe validation. This workspace is stacked on that HEAD.

```text
feat/public-self-service-quote-dev
  └── feat/coupon-center-v1-dev-v2   (PR #48)
        └── feat/commercial-review-workspace-v1-dev
```

After #48 is validated/merged, retarget/rebase this branch carefully. Do not rewrite Coupon Center history.

## What already existed (reused)

| Area | Source | Action |
|------|--------|--------|
| Quote list / detail | `app/quotes`, `fetchQuoteDetail` | Reuse as the single internal entry |
| Quote versions / snapshot | `quote_versions.commercial_snapshot` | Reuse as shared-proposal pin |
| Pricing | `pricing_breakdown` | Server-owned SSOT. No React recalculation |
| Customer / event / menu | existing quote + event + package relations | Display only |
| Coupon dual approval | Coupon Center + `QuoteCouponDecisionCard` | Same PATCH / RPC |
| Share gate | `quoteHasPendingCoupon`, proposal POST 409 | Reuse |
| PDF | `generateQuotePdf` / `QuotePdfDocument` | Reuse; strip internal notes |
| Public proposal | `/proposta/[token]` | Reuse |
| Invoice / PayPal Sandbox | `QuoteInvoicePanel` | Readiness only |
| Capacity | `commercial_rules.schedule_turnaround_buffer.max_concurrent_events` + `agenda_events` + `payment_schedule_holds` | Read-only occupancy |
| Audit | `audit_logs` | Display last quote events |
| i18n | `makeI18nModule` | New `commercialReview` module |
| RBAC | `quotes.view` / `quotes.manage` / `commercial.coupons.manage` | Reuse |

## What was missing (minimum V1)

| Gap | Decision |
|-----|----------|
| Internal commercial notes | `quotes.internal_notes` — never copied to PDF, public proposal, or `commercial_snapshot` |
| Shared version + actor | `quotes.proposal_shared_version_id`, `quotes.proposal_shared_by` stamped on `mark_sent` |
| One commercial workspace | `/quotes/[id]` is now the Commercial Review card workspace |
| Capacity visibility | Read-only card. Opening the quote does **not** reserve |

No second pricing engine. No second coupon RPC. No second share system. No PSCS One FK.

## Migration history

DEV applied this schema as `20260914111651_commercial_review_workspace_v1`. Git previously stored the same SQL as `20260914120000_…`. The file was renamed only. See `docs/qa/commercial-review-migration-reconciliation.md`. Do not reapply. Do not edit `schema_migrations`.

## Financial source of truth

`readCommercialFinancialSummary()` only reads `pricing_breakdown` (fallback: persisted quote columns). It never invents a payable total.

- Pending coupon: current payable stays the snapshot total.
- Applied coupon: discount is the frozen applied amount already in the snapshot.
- Rejected coupon: no discount line is shown as savings.

## Share / version

`POST /api/quotes/[id]/proposal` still blocks while a manual coupon is pending (`coupon_approval_pending`).

On successful `mark_sent` it:

1. Reuses `ensureCurrentQuoteVersion()` so a shared proposal always points at a `quote_versions` row.
2. **Fails closed** if that version cannot be obtained. `proposal_sent_at` is not written without a pin.
3. Stamps `proposal_shared_version_id` + `proposal_shared_by`.
4. Writes `audit_logs.proposal_shared`.

The public page `/proposta/[token]`, `GET /api/public/proposta/[token]`, public PDF, and the shared-proposal PDF all reconstruct commercial facts from that pinned `quote_versions` row + `commercial_snapshot` / frozen `pricing_breakdown`. Live `quotes` money, coupon, guests, package, and additionals do not overwrite the sent proposal.

Legacy proposals with `proposal_shared_version_id` NULL keep a documented live-quote fallback. New V1 shares never take that path.

Customer accept/reject records `accepted_version_id = proposal_shared_version_id` on accept. No second proposal model.

The SQL RPC `get_public_quote_proposal(text)` is kept in the database but is **no longer part of the public API**. Incremental DEV migration `20260914185622_deprecate_get_public_quote_proposal` revokes `EXECUTE` from `PUBLIC`, `anon`, `authenticated`, and `service_role`. The function is not dropped and its body is not rewritten. There is no second snapshot engine in PL/pgSQL. Git filename matches DEV history. See `docs/qa/public-proposal-rpc-hardening-reconciliation.md`.

The Next.js public surface is the only reconstruction path. See `docs/qa/public-proposal-rpc-hardening.md`.

Future package/price/coupon edits create a new current version. They must not rewrite the pinned shared version.

## Capacity

Same rule the PayPal hold uses: `max_concurrent_events` on `schedule_turnaround_buffer`.

- Pilot default on CDL DEV is 3.
- Administrative 4 remains valid if the live rule already stores 4.
- Occupancy counts overlapping `agenda_events` (`reserved|scheduled|completed`) plus active holds, excluding double-counting.
- States: DISPONÍVEL / ATENÇÃO / BLOQUEADO.
- No `acquire_payment_schedule_hold` and no agenda insert from this screen.

## PSCS One readiness (no coupling)

Stable Catering IDs to map later, without a shared database:

- `companies.id`
- `customers.id` (future Party)
- `quotes.id`
- `quote_versions.id`
- proposal token + `proposal_shared_version_id`
- `app_users.id` / actor
- `quote_coupon_applications.id`
- invoice / payment ids already in the finance outbox

Do not create a remote FK. Do not rename PSCS One to PSCS Core.

## Permissions

- Page: `quotes.view`, company scoped via `fetchQuoteDetail`.
- Share / notes: `quotes.manage`.
- Coupon approve/reject: `commercial.coupons.manage`.
- Browser never receives `service_role`.
