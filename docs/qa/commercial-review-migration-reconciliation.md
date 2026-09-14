# Commercial Review — migration reconciliation

**Date:** 2026-09-14  
**Git branch:** `feat/commercial-review-workspace-v1-dev`  
**DEV project:** `yasprgtlqclwsjcshtls`  
**Action:** filename only. SQL body unchanged. `schema_migrations` was not edited. SQL was not reapplied.

## Why

The Git file was stored as:

`supabase/migrations/20260914120000_commercial_review_workspace_v1.sql`

DEV recorded the already-applied history as:

`20260914111651_commercial_review_workspace_v1`

The objects were applied externally on DEV. Replaying the SQL or editing `schema_migrations` would create a false history.

## Matrix

| Migration | Git (before) | Git (after) | DEV live objects | Status | Action |
|-----------|--------------|-------------|------------------|--------|--------|
| `commercial_review_workspace_v1` | `20260914120000_…` | `20260914111651_…` | `quotes.internal_notes`, `quotes.proposal_shared_version_id`, `quotes.proposal_shared_by`, FK `quotes_proposal_shared_version_fk` → `quote_versions(id)` ON DELETE SET NULL, index `idx_quotes_proposal_shared_version` | MATCHED to live history `20260914111651` | **rename only** |

## What this round did

- `git mv` the file to `20260914111651_commercial_review_workspace_v1.sql`
- kept the SQL body unchanged (SHA256 `aacdbfe54d178f92e2e0b67372d92c32d1050689d62ecc0ed9129de97c1e315f`)
- did **not** edit `schema_migrations`
- did **not** reapply the SQL
- pointed `scripts/dev/apply-commercial-review-workspace-dev.mjs` at the reconciled filename; the helper still probes first and no-ops when the three columns already exist

## Live objects (DEV, not recreated)

Confirmed on `public.quotes` for company-scoped selects:

- `internal_notes` text
- `proposal_shared_version_id` uuid
- `proposal_shared_by` uuid
- `quotes_proposal_shared_version_fk` → `public.quote_versions(id)` ON DELETE SET NULL
- `idx_quotes_proposal_shared_version`

## Decision

Git filename now matches DEV history. Columns are live. Official DEV alias is not rebound. PROD is untouched.
