# Resultados QA — Autenticação e Usuários (retomada)

**Data:** 2026-08-04  
**Branch:** `feat/auth-users-rbac-catering-dev`  
**Supabase DEV:** `yasprgtlqclwsjcshtls`  
**Produção:** intacta  

## Pendências fechadas nesta retomada

| Pendência | Resultado | Evidência |
|-----------|-----------|-----------|
| Reset senha E2E | **PASS** | `scripts/dev/test-password-reset-e2e.mjs` — generateLink + verifyOtp (sem token no log); senha antiga recusada; nova autentica; fixture restaurada |
| RBAC fino APIs domínio | **PASS** | `scripts/dev/test-domain-api-rbac.mjs` + `Lib/auth/requireApi.ts` + matriz `docs/qa/domain-api-rbac-matrix.md` |
| Busca/filtros `/users` | **PASS** | `scripts/dev/test-users-search-filters.mjs` + UI/API `q/role/status/page` |
| Spoof `company_id` por Platform Admin sem suporte | **FAIL→PASS** | `rejectSpoofedCompanyId` exige support session para outro company |

## Matriz resumida (Local)

| ID | Ambiente | Perfil | Cenário | Esperado | Encontrado | Evidência | PASS/FAIL | Severidade |
|----|----------|--------|---------|----------|------------|-----------|-----------|------------|
| R1 | Local | fixture | password reset E2E | PASS | PASS | script | PASS | — |
| R2 | Local | multi | domain API RBAC | PASS | PASS | script | PASS | — |
| R3 | Local | admin | users search/filters | PASS | PASS | script | PASS | — |
| R4 | Local | admin | functional suite | 29/0 | 29/0 | `_qa-auth-functional-local.mjs` | PASS | — |
| R5 | Local | JWT | RLS matrix | PASS | PASS | script | PASS | — |
| R6 | Local | — | verify 2830 | PASS | PASS | npm | PASS | — |
| R7 | Local | auth | PDF | application/pdf | 200 pdf | functional | PASS | — |
| R8 | Local | — | build | 0 | 0 | npm | PASS | — |
| R9 | Local | — | lint feature | 0 errors | 0 | eslint scoped | PASS | — |
| R10 | Local | — | lint geral | baseline | 36 errors preexistentes | npm run lint | N/A | — |

## Helpers / segurança

- `requireApiAuth` / `requireApiPermission` / `rejectSpoofedCompanyId` / `resolveAuthorizedCompanyId`
- Permissões reais: `quotes.view|manage`, `customers.view|manage`, `catalog.view|manage`, `users.view|manage|invite`
- Self role change bloqueado (API + UI)
- Sem senha/token/JWT nos logs dos scripts

## Preview

Substituído após commit/push — ver relatório final da entrega (URL do novo deployment).

## Status intermediário (antes do Preview novo)

Testes locais obrigatórios: **PASS**. Seguir para commit/push/Preview.
