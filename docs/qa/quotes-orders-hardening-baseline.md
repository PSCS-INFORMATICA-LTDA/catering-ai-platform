# Baseline — Hardening Quotes/Orders (i18n + testes)

**Data/hora:** 2026-08-05 (~11:00-03:00)  
**Branch hardening:** `chore/quotes-orders-hardening-i18n-tests-dev`  
**Base:** `origin/feat/quotes-orders-operational-foundation-dev` @ `3b68eec`  
**Project Ref:** `yasprgtlqclwsjcshtls` (DEV)  
**Produção:** não usada (`eapwtirhevxrqinytans` ausente do runtime)

## Branches / Previews preservados

| Item | Valor |
|------|--------|
| Quote/Order validação | `feat/quotes-orders-operational-foundation-dev` @ `3b68eec` |
| Preview Philippe | `https://catering-ai-platform-7umlfbmz7-pscs-informatica-ltda-s-projects.vercel.app` |
| Auth | `feat/auth-users-rbac-catering-dev` |
| Preview Auth | `https://catering-ai-platform-6yhxtgwir-pscs-informatica-ltda-s-projects.vercel.app` |

## Working tree no preflight

Untracked locais (não versionados, classificados, mantidos): `scripts/dev/sync-cdl-*-prod-to-dev.mjs` — **não descartados**.

## Testes executados (GATE 0)

| Teste | Resultado |
|-------|-----------|
| `test-password-reset-e2e.mjs` | PASS |
| `test-domain-api-rbac.mjs` | PASS |
| `test-users-search-filters.mjs` | PASS |
| `_test-rls-jwt-matrix.mjs` | PASS (`failed_count=0`) |
| `npm run verify:dev:functional` | PASS · total **2830** |
| `_qa-auth-functional-local.mjs` | **29 PASS / 0 FAIL** · PDF `application/pdf` |
| `preflight-quotes-orders.mjs` | PASS |
| `test-quote-to-order-conversion.mjs` | PASS |
| `test-order-snapshot-total.mjs` | PASS |
| `test-quotes-list-filters.mjs` | PASS |
| `npm run build` | PASS (`build_exit=0`) |

## Achados pré-hardening (não bloqueantes)

- Dict `Lib/i18n/quotesOrders.ts` existe (PT/EN/ES); UI Quotes/Orders ainda majoritariamente hardcoded PT.
- PDF usa `quote.language` no catálogo; chrome misto PT/EN.
- `audit_logs` já gravado em conversão e mudança de status OS; **faltam** checklist, designação de equipe e criação de versão.
- Sem migration necessária para auditoria (`audit_logs` + `service_order_status_history` já existem).

**Decisão:** baseline PASS — autorizado iniciar hardening nesta branch.
