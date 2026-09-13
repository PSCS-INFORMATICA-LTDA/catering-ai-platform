# Coupon Center — migration reconciliation

**Date:** 2026-09-13  
**Git branch:** `feat/coupon-center-v1-dev-v2`  
**DEV project:** `yasprgtlqclwsjcshtls`  
**Evidence:** PostgREST OpenAPI + live `coupons` / `quote_coupon_applications` rows. `supabase_migrations.schema_migrations` is not exposed over REST, so statement-level history could not be dumped.

## Matrix

| Migration | Git | DEV live objects | Content known | Status | Action | Final status |
|-----------|-----|------------------|---------------|--------|--------|--------------|
| `20260913020634_commercial_coupons_v1` | yes | `coupons` + `quote_coupon_applications` columns match Git exactly | yes, from Git file | MATCHED | none | MATCHED |
| `20260913022208_commercial_coupon_public_session_v1` | yes | `public_quote_intake_sessions.coupon_code` selectable | yes | MATCHED | none | MATCHED |
| `20260913024000_coupon_pending_progression_guard` | yes | invoice/SO inserts are guarded in app; function is `private` and not in public RPC cache | Git SQL known | MATCHED (behavior present; SQL history not readable) | none | MATCHED |
| `20260913024500_coupon_pending_guard_function_privileges` | yes | public RPC lookup of the guard function 404s (expected, privileges revoked) | Git SQL known | MATCHED | none | MATCHED |
| `20260913040124_coupon_rules_v1` | **no** | `public.coupon_rules` 404; OpenAPI has no such table | original SQL **not recovered** | UNVERIFIED_HISTORY / NOT_IN_LIVE_SCHEMA | do not invent the file; do not mark applied | DOCUMENTED, not fabricated |
| `20260913190000_coupon_customer_usage_lock` | yes | function not in live PostgREST yet; persist uses UUID v5 customer-usage claim until the RPC is applied | yes, from Git file | LOCAL_ONLY until Management/SQL apply | apply this file only when a DEV SQL console/token exists; never recreate `40124` | IN_GIT, claim-id barrier live |

## Live coupon catalog (DEV, not deleted)

All four rows are company `65fd576f-8d97-49ba-bf38-61bc1e94e94a` and marked `dev_example` / not production-approved:

- `WELCOME` active fixed $100, min eligible $1100, deposit=false, balance=true
- `CDL10` active 5% manual approval, deposit=false, balance=true
- `WEEKDAY50` draft
- `PARTNER7` draft

`quote_coupon_applications` is empty.

## Decision

`20260913040124_coupon_rules_v1` remains **UNVERIFIED_HISTORY / NOT_IN_LIVE_SCHEMA**. The original SQL was not recovered. No look-alike file was added.

`20260913190000_coupon_customer_usage_lock` is the only new forward-only SQL in this round. It adds `public.reserve_quote_coupon_application` as the concurrent last barrier for `max_uses_per_customer` / `max_uses_per_quote`. It does not create `coupon_rules`.

If Philippe later recovers the exact `20260913040124_coupon_rules_v1` statement from `supabase_migrations.schema_migrations`, attach that exact SQL. Do not write a look-alike.
