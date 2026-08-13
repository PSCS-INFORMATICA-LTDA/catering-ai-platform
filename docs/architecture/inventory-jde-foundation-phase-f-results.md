# Inventory JDE Foundation V1 — Fase F (QA)

**Data:** 2026-08-13  
**Branch:** `feat/inventory-jde-foundation-dev`  
**Ambiente:** DEV `yasprgtlqclwsjcshtls` · empresa CDL `65fd576f-8d97-49ba-bf38-61bc1e94e94a`  
**Status:** **PASS** — foundation pronta para validação de Philippe

---

## A. Resumo executivo

Fase F concluída: scripts de QA JDE (T01–T32), reconciliação corrigida para dimensões branch/location/item/lot, regressão de posting OS adaptada ao modelo de documentos, build Next.js e typecheck OK.

---

## B. Scripts executados

| Script | Resultado |
|--------|-----------|
| `test:dev:inventory-jde-foundation` | **PASS** (T01–T32) |
| `test:dev:inventory-core` | **PASS** (T01–T08, T19) |
| `test:dev:inventory-order-posting` | **PASS** (T09–T18) |
| `test:dev:inventory-jde-domain` | **PASS** (C1–C5) |
| `test:dev:inventory-os-integration` | **PASS** (D1–D3) |
| `test:dev:inventory-reconciliation` | **PASS** (0 diffs, 14 saldos) |
| `test:dev:inventory-all` | **PASS** (suite completa) |
| `test:dev:order-materials` | **PASS** |
| `test:dev:order-financial-rbac` | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |

---

## C. Correções desta fase

### Reconciliação (`test-inventory-reconciliation.mjs`)

- Agrega ledger por **branch + location + item + lot** (antes: só location + item).
- Executa `rebuild_inventory_balances` antes da comparação.

### Posting OS (`test-inventory-order-posting.mjs`)

- Limpa documentos/linhas/commitments do OS QA antes de cada run (evita duplicate key JDE).
- `bal()` soma saldos multi-localização.
- T13: reset de ledger de retorno antes do teste de delta (idempotência por target).
- T18: aceita `errors[]` / erro Supabase além de `ok: false`.

### Novo script (`test-inventory-jde-foundation.mjs`)

Matriz do plano 12/08 §61–65:

- **T01–T07:** hierarquia branch/location/lot + cross-tenant  
- **T08–T14:** disponibilidade (On Hand, Committed, Available, In Event, On Receipt)  
- **T15–T22:** documentos + kardex + idempotência  
- **T23–T27:** lote  
- **T28–T32:** reservas OS  

---

## D. Rotas UI validadas no build

- `/estoque`, `/estoque/disponibilidade`, `/estoque/reservas`
- `/estoque/kardex`, `/estoque/documentos`, `/estoque/locais`, `/estoque/lotes`

### Preview DEV (smoke 2026-08-13)

| Item | Valor |
|------|--------|
| Branch | `feat/inventory-jde-foundation-dev` @ `b9d9386` (+ hotfix `posted_at`) |
| Preview | https://catering-ai-platform-cc05n5gbx-pscs-informatica-ltda-s-projects.vercel.app |
| Deploy | `vercel deploy` (sem `--prod`) |
| Smoke script | `QA_BASE_URL=<preview> node scripts/dev/validate-preview-inventory-ui.mjs` |
| Resultado | **PASS** — 7 pages + 8 APIs |

**Hotfix durante smoke:** `GET /api/inventory/documents` retornava 500 — coluna `posted_at` inexistente; corrigido para derivar de `created_at` quando `status=posted`.

---

## E. Regressões 11/08

Executadas nesta fase (amostra técnica):

- Materiais OS + segregação financeira: **PASS**
- Inventory v1 + JDE + posting: **PASS**

Regressões visuais completas (cotação PDF, agenda T01–T18, telefone/CEP) permanecem recomendadas no preview DEV antes do merge.

---

## F. Pendências — aguardando Philippe

- Prints JDE F4111 / P41202 — validação final de campos  
- Códigos IB/ED/ER/LR/AI/AO/TR — aprovação definitiva  
- Seed `TEST-DEV-ORLANDO` + locais MAIN/FREEZER/EQUIPMENT (opcional; QA usa dados efêmeros)  
- Inventário físico, ajustes, transferências, procurement — **fora desta foundation**

---

## G. Comandos úteis

```bash
npm run test:dev:inventory-all
npm run test:dev:inventory-jde-foundation
npm run test:dev:inventory-reconciliation
npm run build
```

---

**STATUS FINAL:** ESTOQUE JDE-LIKE — FOUNDATION V1 **PRONTA PARA VALIDAÇÃO DE PHILIPPE**  
DEV ONLY · PRODUCTION/MAIN INTACTAS · SEM CUSTO/VALUATION · SEM AP
