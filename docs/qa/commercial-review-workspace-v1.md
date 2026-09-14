# Commercial Review Workspace V1 — QA

**Branch:** `feat/commercial-review-workspace-v1-dev`  
**Base:** `feat/coupon-center-v1-dev-v2`  
**Do not merge PR #48.**  
**Do not bind official DEV in this round.**

## Matrix

| Id | Case | How |
|----|------|-----|
| A | Quote without coupon | Neutral coupon card + financial snapshot |
| B | Automatic coupon applied | Applied card, reduced total from snapshot |
| C | Manual coupon pending | Existing `coupon-quote-decision` card |
| D | Approve from Commercial Review | Same PATCH as Coupon Center |
| E | Reject from Commercial Review | Same PATCH as Coupon Center |
| F | User without `commercial.coupons.manage` | Read-only pending card |
| G | Share blocked while pending | 409 `coupon_approval_pending` |
| H | Share after approve | 200 + pinned version |
| I | Share after reject | 200 + no discount |
| J | quote_version | Current version id visible |
| K | snapshot | Totals come from `pricing_breakdown` |
| L | PDF | Internal notes omitted |
| M | Deposit / balance | Snapshot deposit/balance |
| N | Capacity | State + configured + reserved |
| O | Tenant isolation | Other company 404 / unauth 307 |
| P | Mobile | Cards + sticky actions, 390px |
| Q | PT/EN/ES | `Lib/i18n/commercialReview.ts` |
| R | Internal note persist | Persist QA PATCH + reload |
| S | Notes do not leak | Public proposal + PDF + `commercial_snapshot` |
| T | Proposal version pin | `mark_sent` stamps `proposal_shared_version_id` |
| U | `proposal_shared_by` | Actor = `app_users.id` |
| V | Pin stability | Later current version does not move the pin |
| W | Pending share block | `409 coupon_approval_pending` |
| X | Approve → share | Same coupon PATCH + `mark_sent` |
| Y | Reject → share | Same coupon PATCH + `mark_sent` |

Migration filename on Git must match DEV history: `20260914111651_commercial_review_workspace_v1.sql`. See `docs/qa/commercial-review-migration-reconciliation.md`.

## Commands

```bash
npm test
npm run typecheck
npx eslint Lib/commercialReview components/commercial-review app/quotes/[id]/page.tsx app/api/quotes/[id]/proposal/route.ts app/api/quotes/[id]/internal-notes/route.ts Lib/i18n/commercialReview.ts
npm run build
node scripts/dev/apply-commercial-review-workspace-dev.mjs
COMMERCIAL_REVIEW_BASE_URL=https://<preview> node scripts/dev/test-commercial-review-http.mjs
COMMERCIAL_REVIEW_BASE_URL=https://<preview> npm run test:dev:commercial-review-persist-qa
npm run test:dev:coupon-persist-qa
```
