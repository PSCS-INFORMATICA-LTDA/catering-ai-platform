# Public proposal RPC hardening — migration reconciliation

**Date:** 2026-09-14  
**Git branch:** `feat/commercial-review-workspace-v1-dev`  
**DEV project:** `yasprgtlqclwsjcshtls`  
**Action:** filename only. SQL body unchanged. `schema_migrations` was not edited. SQL was not reapplied.

## Why

Git stored the revoke migration as:

`supabase/migrations/20260914183400_deprecate_get_public_quote_proposal.sql`

DEV recorded the already-applied history as:

`20260914185622_deprecate_get_public_quote_proposal`

The revoke was applied externally on DEV. Replaying the SQL or editing `schema_migrations` would create a false history.

## Matrix

| Migration | Git (before) | Git (after) | DEV live objects | Status | Action |
|-----------|--------------|-------------|------------------|--------|--------|
| `deprecate_get_public_quote_proposal` | `20260914183400_…` | `20260914185622_…` | `public.get_public_quote_proposal(text)` still exists; `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated`, `service_role`; DEPRECATED comment present; function body unchanged | MATCHED to live history `20260914185622` | **rename only** |

## What this round did

- `git mv` the file to `20260914185622_deprecate_get_public_quote_proposal.sql`
- kept the SQL body unchanged (SHA256 `5ae4fc91e02fcb1cb3a35504289324ec58919df370456cfaffa859ecee86c95e`)
- did **not** edit `schema_migrations`
- did **not** reapply the SQL
- did **not** generate a new equivalent migration
- pointed `scripts/dev/apply-deprecate-public-quote-proposal-dev.mjs` at the reconciled filename; the helper still probes first and no-ops when EXECUTE is already gone

## Live objects (DEV, not recreated)

Confirmed on DEV after the external apply:

- function `public.get_public_quote_proposal(text)` still exists
- function body was not rewritten
- DEPRECATED comment remains
- `anon` EXECUTE = false
- `authenticated` EXECUTE = false
- `service_role` EXECUTE = false
- Security Advisor no longer lists this function under `anon_security_definer_function_executable` or `authenticated_security_definer_function_executable`

Unrelated historical SECURITY DEFINER RPCs were not changed.

## Decision

Git filename now matches DEV history. Official DEV alias is not rebound. PROD is untouched.
