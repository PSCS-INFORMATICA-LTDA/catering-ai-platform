# Public proposal RPC hardening — QA

**Branch:** `feat/commercial-review-workspace-v1-dev`  
**PR:** #49  
**DEV:** `yasprgtlqclwsjcshtls`  
**PROD:** untouched  
**Function:** `public.get_public_quote_proposal(text)` only

Do not merge PR #48 or #49. Do not rebind official DEV. Do not touch PayPal Live.

## Audit — `get_public_quote_proposal`

Repo-wide search before the revoke:

| Location | Kind | Runtime? |
|----------|------|----------|
| `app/api/public/proposta/[token]/route.ts` | uses `loadPublicProposalByToken()` | **No** — Next.js is the canonical public surface |
| `app/api/public/proposta/[token]/pdf/route.ts` | frozen shared PDF via Next.js | **No** |
| `app/proposta/[token]/page.tsx` | Next.js page | **No** |
| `Lib/commercialReview/loadPublicProposal.ts` | reconstruction engine | **No** |
| `scripts/dev/run-commercial-review-persist-qa.mjs` | HTTP to Next.js public routes | **No** |
| `scripts/dev/test-commercial-review-http.mjs` | HTTP to quote workspace | **No** |
| `supabase/migrations/20260804180000_quote_proposals.sql` | historical `CREATE FUNCTION` | SQL history only |
| `supabase/migrations/20260911164000_public_token_rpc_least_privilege.sql` | historical GRANT to anon/authenticated/service_role | SQL history only |
| `docs/architecture/commercial-review-workspace-v1.md` | leftover documentation (updated) | Docs only |

No `.rpc('get_public_quote_proposal')` remains in `app/`, `Lib/`, or QA scripts.

Unrelated public-token RPCs that **remain in use** and were **not** revoked in this round:

- `get_public_supplier_garnish` — `app/api/public/confirmacao-guarnicao/[token]/route.ts`
- `get_public_team_assignment` — `app/api/public/designacao-equipe/[token]/route.ts`
- `get_public_team_member_confirmation` — `app/api/public/confirmacao-equipe/[token]/route.ts`
- `get_public_material_dispatch_confirmation` — public material dispatch + QA scripts

## What this round does

Migration: `supabase/migrations/20260914183400_deprecate_get_public_quote_proposal.sql`

- `REVOKE EXECUTE` from `PUBLIC`, `anon`, `authenticated`, `service_role`
- `COMMENT` marking the function DEPRECATED
- `NOTIFY pgrst, 'reload schema'`
- **No DROP**
- **No CREATE OR REPLACE**
- **No second snapshot engine in PL/pgSQL**

The Next.js public surface stays the only reconstruction path:

`proposal_shared_version_id` → `quote_versions` → `commercial_snapshot` / frozen `pricing_breakdown`

## Commands

```bash
node scripts/dev/apply-deprecate-public-quote-proposal-dev.mjs
node scripts/dev/test-public-proposal-rpc-hardening.mjs
COMMERCIAL_REVIEW_BASE_URL=https://<preview> node scripts/dev/test-commercial-review-http.mjs
COMMERCIAL_REVIEW_BASE_URL=https://<preview> npm run test:dev:commercial-review-persist-qa
```

## Required proofs

| Id | Proof | How |
|----|-------|-----|
| A | anon cannot execute the RPC | hardening script — not `42703 column c.name` |
| B | authenticated cannot execute the RPC | signed-in session + same RPC |
| C | service_role cannot execute the RPC | service key + same RPC |
| D | `/proposta/[token]` stays 200 | persist QA |
| E | `GET /api/public/proposta/[token]` stays 200 | persist QA |
| F | public PDF still works | persist QA |
| G | shared proposal stays on frozen V1 after live V2 | persist QA |
| H | customer accept sets `accepted_version_id = proposal_shared_version_id` | persist QA |
| I | `internal_notes` do not leak | persist QA |
| J | `mark_sent` fail-closed without `quote_version` | persist QA |

A 42703 / `column c.name does not exist` result is a **fail**: the function still executed.

A dummy token can return `{ found: false }` without reaching `companies.name`. Proofs A–C must use a real `proposal_token` so a still-public RPC is caught as `42703`, not as a quiet miss.

Apply on DEV requires `SUPABASE_ACCESS_TOKEN` or a linked CLI session. This helper refuses PROD and does not edit `schema_migrations`.

Security Advisor is re-checked only for this function. Historical SECURITY DEFINER warnings on unrelated RPCs are out of scope.
