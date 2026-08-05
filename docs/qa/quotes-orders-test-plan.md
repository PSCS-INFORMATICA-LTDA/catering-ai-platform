# Plano de testes — Cotações e Ordem/OS

**Baseline:** `docs/qa/quotes-orders-baseline-before.md`  
**Branch:** `feat/quotes-orders-operational-foundation-dev`  
**DEV:** `yasprgtlqclwsjcshtls` · **PROD proibido**

---

## Gate 0 — Baseline Auth

Scripts: password-reset, domain-rbac, users-filters, RLS JWT, verify functional 2830, auth matrix, `_qa-auth-functional-local` (29 PASS), build, lint Auth.

**Critério:** tudo PASS antes de implementar.

---

## Gate 1 — Lista/detalhe cotações

- Busca número/cliente/evento  
- Filtros status, datas, aceite, com/sem OS  
- Paginação, ordenação, URL, empty/loading/erro  
- Detalhe consolidado + versões  
- PT/EN/ES + mobile  
- Regressão Auth  

Script: `scripts/dev/test-quotes-list-filters.mjs`

---

## Gate 2 — Aceite/status

- Transições válidas/inválidas  
- Aceite/rejeição idempotente  
- Share público sem regressão  
- Token cross-tenant  

Scripts: `test-quote-versions-status.mjs`, `test-quote-acceptance-idempotency.mjs`

---

## Gate 3 — Migration OS

- Preflight PASS  
- dry-run só migrations da branch  
- push DEV · upToDate  
- RLS/constraints  

Script: `scripts/dev/preflight-quotes-orders.mjs`

---

## Gate 4 — Conversão

Cenários 1–16 da solicitação (draft negado, accepted ok, duplo clique, concorrência, snapshot, total, cross-tenant, 401/403).

Scripts: `test-quote-to-order-conversion.mjs`, `test-order-snapshot-total.mjs`, `test-orders-rbac-rls.mjs`

---

## Gate 5 — Agenda/equipe/checklist

- Vínculo OS ↔ agenda  
- Designação  
- Checklist  
- Conflito  

Script: `test-order-schedule-team.mjs`

---

## Gate 6 — Build + Preview

- Regressão Auth completa + 29 PASS + 2830 + PDF  
- lint scoped  
- push branch  
- Preview novo (não Auth) · smoke  

Script: `test-quotes-orders-regression.mjs`

---

## Critério de saída

`PRONTO PARA VALIDAÇÃO DE PHILIPPE — COTAÇÕES E ORDEM/OS` somente com checklist §47 da solicitação atendido.
