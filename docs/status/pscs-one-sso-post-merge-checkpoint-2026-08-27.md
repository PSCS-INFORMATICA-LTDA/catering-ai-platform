# Checkpoint — PSCS One → Catering AI SSO (post-merge PR #30)

**Recorded:** 2026-08-27 (UTC)  
**Repo:** `PSCS-INFORMATICA-LTDA/catering-ai-platform`  
**Canonical DEV:** https://catering-ai-agenda-dev.vercel.app  
**Supabase DEV ref:** `yasprgtlqclwsjcshtls`  
**PSCS One DEV:** https://pscs-core.vercel.app  
**Mode:** documentation only — no application code, database, env, or PROD changes in this checkpoint.

## Root cause (incident)

**ROOT_CAUSE:** callback existed historically but was absent from the branch pinned to canonical DEV.

PR #11 merged the PSCS One SSO adapter into `feat/quote-wizard-v2-dev`, while the canonical DEV alias remained pinned to `cursor/public-experience-v5-fire-signature`, which had `/login` but not `GET /auth/pscs-one/callback`. The route was never deleted from Git; it was missing from the deployed branch lineage.

## Restoration

| Item | Value |
|------|--------|
| Merged PR | [#30](https://github.com/PSCS-INFORMATICA-LTDA/catering-ai-platform/pull/30) |
| Merge commit | `97ce0a0bded83ee872cafdbd781717f9c134f447` |
| Restored route | `GET /auth/pscs-one/callback` |
| Implementation path | `app/auth/pscs-one/callback/route.ts`, `Lib/pscs-one/*` |
| Original SSO PR | [#11](https://github.com/PSCS-INFORMATICA-LTDA/catering-ai-platform/pull/11) |
| Original SSO commit | `1d72a9f` |

## Canonical DEV deployment (verified read-only)

| Item | Value |
|------|--------|
| Alias | `catering-ai-agenda-dev.vercel.app` |
| Deployment ID | `dpl_HFfPedzsn3TxSw4na7KQMNTdqebo` |
| Deployed SHA | `97ce0a0` |
| Deployed branch | `cursor/public-experience-v5-fire-signature` |
| Alias stale? | **NO** — alias already points at merge commit `97ce0a0` |

### Automated smoke (2026-08-27 UTC)

| Check | Result |
|-------|--------|
| `GET /auth/pscs-one/callback?code=dummy&state=dummy` | **307** (not 404) |
| `x-matched-path` | `/auth/pscs-one/callback` |
| `GET /login` | **200** |
| `GET /quotes` (unauthenticated) | **307** → `/login?next=%2Fquotes` |

## Human QA flow (recorded)

1. PSCS One login  
2. Abrir Catering AI  
3. Callback (`/auth/pscs-one/callback`)  
4. Catering session established  
5. Navigate to `/quotes`  
6. No second login required  

## Status matrix (frozen baseline)

```
PR_30_MERGED=YES
ONE_TO_CATERING_CALLBACK_ROUTE=PASS
ONE_TO_CATERING_SSO_HUMAN_QA=PASS
SECOND_LOGIN_REQUIRED=NO
CATERING_QUOTES_LOADED=PASS
CALLBACK_404=NO
DATABASE_WRITES=0
CATERING_PROD_TOUCHED=NO
```

| Gate | Status |
|------|--------|
| PR #30 merged | **YES** |
| One → Catering callback route | **PASS** |
| One → Catering SSO human QA | **PASS** |
| Second login required | **NO** |
| Catering `/quotes` loaded | **PASS** |
| Callback 404 | **NO** |
| Database writes | **0** |
| Catering PROD touched | **NO** |

## SSO contract (names only)

| Variable | Catering DEV |
|----------|----------------|
| `PSCS_ONE_SSO_ENABLED` | configured (production scope on Vercel) |
| `PSCS_ONE_TOKEN_URL` | configured |
| `PSCS_ONE_CLIENT_ID` | configured |
| `PSCS_ONE_CLIENT_SECRET` | configured (value not recorded) |
| `PSCS_ONE_REDIRECT_URI` | `https://catering-ai-agenda-dev.vercel.app/auth/pscs-one/callback` |

Redirect URI matches implemented callback path.

## Baseline freeze

```
ONE_TO_CATERING_SSO=STABLE
SSO_BASELINE_FROZEN=YES
```

This checkpoint freezes the post-merge SSO baseline. Further SSO changes require a new checkpoint and explicit human approval. Rollback remains: unset `PSCS_ONE_SSO_ENABLED`; legacy `/login` stays (see `docs/integrations/PSCS_ONE_SSO.md`).

## References

- Integration guide: `docs/integrations/PSCS_ONE_SSO.md`
- Env names only: `env.pscs-one-sso.example`
- Incident remediation PR: #30
