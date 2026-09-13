# Coupon Center — migration reconciliation

**Date:** 2026-09-13  
**Git branch:** `feat/coupon-center-v1-dev-v2`  
**DEV project:** `yasprgtlqclwsjcshtls`  
**Evidence:** PostgREST OpenAPI + live `coupons` / `quote_coupon_applications` rows + live RPC probe of `reserve_quote_coupon_application`. `supabase_migrations.schema_migrations` is not exposed over REST.

## Matrix

| Migration | Git | DEV live objects | Content known | Status | Action | Final status |
|-----------|-----|------------------|---------------|--------|--------|--------------|
| `20260913020634_commercial_coupons_v1` | yes | `coupons` + `quote_coupon_applications` columns match Git exactly | yes, from Git file | MATCHED | none | MATCHED |
| `20260913022208_commercial_coupon_public_session_v1` | yes | `public_quote_intake_sessions.coupon_code` selectable | yes | MATCHED | none | MATCHED |
| `20260913024000_coupon_pending_progression_guard` | yes | invoice/SO inserts are guarded in app; function is `private` and not in public RPC cache | Git SQL known | MATCHED (behavior present; SQL history not readable) | none | MATCHED |
| `20260913024500_coupon_pending_guard_function_privileges` | yes | public RPC lookup of the guard function 404s (expected, privileges revoked) | Git SQL known | MATCHED | none | MATCHED |
| `20260913040124_coupon_rules_v1` | **no** | `public.coupon_rules` 404; OpenAPI has no such table | original SQL **not recovered** | UNVERIFIED_HISTORY / NOT_IN_LIVE_SCHEMA | do not invent the file; do not mark applied | DOCUMENTED, not fabricated |
| `20260913190825_coupon_customer_usage_lock` | yes (renamed from Git `20260913190000_*` to match DEV history) | `public.reserve_quote_coupon_application` live; probe with null args returns `P0001 coupon_invalid_arguments`; grants: anon/authenticated NO EXECUTE, service_role EXECUTE | yes, exact SQL already applied on DEV | MATCHED to live history `20260913190825` | **do not reapply**; file was only renamed | RECONCILED |
| `20260913221500_coupon_decide_application` | yes | new forward-only `public.decide_quote_coupon_application` | yes, from Git file | NEW | apply this file only; never reapply `190825` | PENDING live apply in this round |

## Usage-lock reconciliation

Philippe already applied the customer usage lock on DEV as version `20260913190825_coupon_customer_usage_lock`. Git previously stored the same SQL as `20260913190000_coupon_customer_usage_lock.sql`.

This round:

- renamed the Git file to `20260913190825_coupon_customer_usage_lock.sql`
- kept the SQL body unchanged
- did **not** edit `schema_migrations`
- did **not** reapply the function
- updated `scripts/dev/apply-coupon-customer-usage-lock-dev.mjs` so it probes first and no-ops when the RPC already exists

`20260913040124_coupon_rules_v1` remains **UNVERIFIED_HISTORY / NOT_IN_LIVE_SCHEMA**. The original SQL was not recovered. No look-alike file was added.

## Live coupon catalog (DEV, not deleted)

All four rows are company `65fd576f-8d97-49ba-bf38-61bc1e94e94a` and marked `dev_example` / not production-approved:

- `WELCOME` active fixed $100, min eligible $1100, deposit=false, balance=true
- `CDL10` active 5% manual approval, deposit=false, balance=true
- `WEEKDAY50` draft
- `PARTNER7` draft

## Decision

Git + DEV objects are reproducible for the usage-lock RPC after the filename rename. The decide RPC is a new forward-only migration and is the only SQL this round may apply.
