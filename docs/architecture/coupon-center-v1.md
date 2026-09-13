# Coupon Center V1

**Status:** DEV live — `decide_quote_coupon_application` is live on DEV (`SECURITY DEFINER`, `service_role` only). Approve/reject uses the atomic RPC. Compensating fallback remains only if the RPC is missing. Not merged, not production. Approval remains Philippe’s.
**Branch:** `feat/coupon-center-v1-dev-v2`  
**PR:** #48  
**Environment:** DEV only (`yasprgtlqclwsjcshtls`)  
**Product name:** PSCS One remains the future shared product name. This module stays Catering AI domain.

## Architecture

There is one coupon model and one pricing engine.

1. Browser may send `coupon_code` only.
2. `normalizeCouponCode()` is the single code normalizer (`trim` + uppercase + `^[A-Z0-9][A-Z0-9_-]{1,31}$`).
3. `evaluateCouponForPricing()` in `Lib/coupons/couponMath.ts` is the canonical rule + money engine.
4. `resolveCouponForPricing()` loads tenant-scoped coupon, customer identity and catalog, then calls the same engine.
5. `applyCouponToBreakdown()` writes the authorized total, deposit and balance into the pricing breakdown.
6. Preview, submit, quote persistence, quote version snapshot, invoice snapshot, PayPal amount and Order/Service Order conversion all consume that result or the frozen snapshot. They do not re-read the live coupon to reconstruct a historical total.

```text
Public code
  → /api/public/coupons/preview
  → resolveCouponForPricing
  → evaluateCouponForPricing + allocateCouponDiscount
  → computeQuotePricing(base, discountAmount=0)
  → applyCouponToBreakdown
  → session.coupon_code

Submit
  → same resolver
  → finalize_public_quote
  → persistQuoteCouponApplication
  → public.reserve_quote_coupon_application (row lock + customer usage lock)
  → quotes + current quote_versions snapshot
```

## Tables

Existing structures reused. No second coupon schema.

| Object | Owner | Role |
|--------|-------|------|
| `coupons` | company_id | Rule definition |
| `quote_coupon_applications` | company_id + quote_id | Application + frozen amounts |
| `public_quote_intake_sessions.coupon_code` | session | Public request only |
| `quotes.pricing_breakdown.coupon` | quote | Commercial snapshot |
| `quote_versions.commercial_snapshot.coupon` | version | Immutable historical facts |
| `invoices.snapshot.commercial.coupon` | invoice | Frozen receivable evidence |

`coupon_rules` and `coupon_audit_events` do **not** exist in DEV. Do not recreate them.

## Pricing source of truth

`Lib/coupons/couponMath.ts` owns:

- eligible subtotal from breakdown lines
- percent / fixed potential
- max discount cap
- weekday / package / customer / usage / validity
- allocation to deposit and/or balance
- invariants:
  - `discount >= 0`
  - `discount <= eligible_subtotal`
  - `final_total >= 0`
  - `final_total = canonical_total - authorized_discount`
  - `deposit_due + balance_due = final_total`
  - no negative deposit or balance

`computeQuotePricing()` calculates the commercial quote **without** a client-owned discount. Coupon discount is applied afterwards by `applyCouponToBreakdown()`. The previous path that passed `discountAmount` into a second `computeQuotePricing()` call was removed because it double-subtracted.

Currency is server-owned (`USD` in the coupon snapshot). The browser cannot set discount, totals, approval or currency.

## Deposit / balance semantics

The columns already existed. They are no longer decorative.

| Flags | Behavior |
|-------|----------|
| `apply_to_balance=true`, `apply_to_deposit=false` | Default. Discount reduces balance first and never the deposit. Overflow is capped, not converted into credit. |
| `apply_to_deposit=true`, `apply_to_balance=false` | Discount reduces only the deposit, capped at the deposit. |
| both true | Balance is reduced first (reservation protected). Leftover may reduce deposit. |
| both false | Rejected as `invalid_configuration`. |

Existing DEV coupons (`WELCOME`, `CDL10`, drafts) already use deposit=false / balance=true.

## Approval

Statuses: `pending` → `applied` or `rejected`. `revoked` remains in the check constraint for future use.

- Manual coupons persist a quote with `applied_discount_amount = 0`.
- Pending blocks invoice create, deposit confirmation / agenda reserve, and service-order conversion in application code.
- Database trigger `private.assert_no_pending_coupon_for_quote` remains the last barrier on `invoices` and `service_orders`.
- Approve/reject require `commercial.coupons.manage`, are company-scoped, and go through `public.decide_quote_coupon_application` (`SECURITY DEFINER`, `service_role` only).
- The RPC locks the application (and the quote on approve/reject) and writes `quote_coupon_applications` + `quotes` + current `quote_versions` in one transaction. Partial financial state is not allowed.
- Reject also stamps `pricing_breakdown.coupon.approval_status = rejected` so the UI cannot keep showing a projected discount.
- If that RPC is missing, approve/reject uses a compensating fallback that reverts the application (and quote/version snapshots) when a later write fails. The fallback is temporary and is not the atomic target. Official DEV now prefers the RPC and returns `via: "rpc"` on success.
- Money math stays in TypeScript (`allocateApprovedCoupon` on the frozen `potential_discount_amount`). The RPC only applies the server-built patch.
- Retry of the same decision is idempotent. Applied/rejected cannot return to pending in the API.
- Approval uses the frozen `potential_discount_amount` and `rules_snapshot`, not the live coupon definition.

## Idempotency

- Public session stores one `coupon_code`.
- Submit includes coupon facts in the submission hash.
- `uq_quote_coupon_once` on `(quote_id, coupon_id)`.
- Approval uses conditional update.
- `max_uses_per_customer` is checked server-side via `customers.phone_normalized` before submit.
- The last barrier is `public.reserve_quote_coupon_application` (`SECURITY DEFINER`, `service_role` only): coupon `FOR UPDATE`, customer advisory lock, then count `pending|applied` uses and insert. Same quote+coupon is idempotent.
- If that RPC is not yet live, persist falls back to a deterministic UUID v5 claim on `quote_coupon_applications.id` for `(company, coupon, customer, slot)`. The primary key is the concurrent mutex: two first uses of a limit=1 coupon collide and only one row is stored.

## RLS

`coupons` and `quote_coupon_applications` are company-scoped through `private.has_permission(company_id, ...)`. Anon has no grants. Browser never receives `service_role`. Public preview uses the session tenant, not a client `company_id`.

## Snapshot

When a coupon is part of a commercial version, the snapshot stores coupon id, code, campaign name, type, configured value, eligible amount, calculated discount, allocation, approval status, timestamps and currency. Changing `WELCOME` later must not rewrite that snapshot.

## Payments

PayPal Sandbox remains the only allowed PayPal mode. `/api/payments/paypal/orders` calls `ignoreClientAmount()`. Payable amount comes from the invoice snapshot. A pending coupon cannot create that invoice.

## i18n

Public and admin coupon copy live in `Lib/i18n/coupons.ts` via `makeI18nModule` and the existing registry. No second translation framework. Public placeholders never show a live catalog code. Pending coupons keep the payable total unchanged and show a separate estimated total after approval. Applied coupons show the saved amount and the new server-owned total.

## Outbox

Catering already has `finance_integration_outbox` for invoice/payment/refund events. Coupon domain events are **not** published there in this round. The future contract is documented in `docs/integration/pscs-one-coupon-readiness.md`.
