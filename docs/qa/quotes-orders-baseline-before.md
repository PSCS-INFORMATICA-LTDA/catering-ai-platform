# Baseline — Quotes/Orders Operational Foundation (antes da implementação)

**Data/hora:** 2026-08-05T08:52:42-03:00 (início) · baseline Auth concluída ~09:00-03:00  
**Diretório:** `D:\PSCS\catering-ai-platform`  
**Origin:** `https://github.com/PSCS-INFORMATICA-LTDA/catering-ai-platform.git`

## Git

| Item | Valor |
|------|--------|
| Branch no momento da baseline | `feat/auth-users-rbac-catering-dev` (limpa após stash) |
| HEAD baseline | `e115c0d` — `feat(agenda): bloqueia equipe já ocupada na mesma data` |
| Paridade com `origin/feat/auth-users-rbac-catering-dev` | 0 ahead / 0 behind |
| Commit Auth principal citado | `a7f34d5` — `feat(auth): conclui QA, RBAC e gestão de usuários` (ancestral) |
| Docs Preview Auth | `e0df956` — `docs(qa): registra Preview a7f34d5…` (ancestral) |
| Preview Auth (não sobrescrever) | `https://catering-ai-platform-6yhxtgwir-pscs-informatica-ltda-s-projects.vercel.app` |

### Working tree (investigação)

Antes da baseline a working tree **não estava limpa**. Continha WIP local (Pessoas/Address Book, proposta pública, designação de equipe, migrations 20260804*, Matriz V2, etc.), não commitado na branch Auth.

**Ação segura:** `git stash push -u` com mensagem `wip-pre-quotes-orders-foundation-20260805-085211` → baseline na árvore limpa → criação da branch nova → `git stash pop` na branch nova.

**Nada foi descartado.** Branch Auth permanece em `e115c0d` sem commits novos desta entrega.

### Branch desta entrega (pós-baseline)

| Item | Valor |
|------|--------|
| Branch | `feat/quotes-orders-operational-foundation-dev` |
| Base | `origin/feat/auth-users-rbac-catering-dev` @ `e115c0d` |
| WIP restaurado | sim (stash pop) |

## Ambiente

| Item | Valor |
|------|--------|
| Supabase linked | `yasprgtlqclwsjcshtls` (catering-ai-platform-DEV) |
| `.env.local` | aponta para DEV (`yasprgtlqclwsjcshtls`) |
| PROD `eapwtirhevxrqinytans` | **não usado** |
| Confirmação Produção | nenhuma operação em PROD; sem `vercel --prod`; sem merge/push em `main` |

## Testes executados (GATE 0)

| # | Comando | Resultado |
|---|---------|-----------|
| 1 | `node scripts/dev/test-password-reset-e2e.mjs` | **PASS** (`PASSWORD RESET E2E: PASS`) |
| 2 | `node scripts/dev/test-domain-api-rbac.mjs` | **PASS** (`DOMAIN API RBAC: PASS`) |
| 3 | `node scripts/dev/test-users-search-filters.mjs` | **PASS** (`USERS SEARCH/FILTERS: PASS`) |
| 4 | `node scripts/dev/_test-rls-jwt-matrix.mjs` | **PASS** (`RLS/MULTIEMPRESA: PASS`, `failed_count=0`) |
| 5 | `npm run verify:dev:functional` | **PASS** (`VERIFY_RESULT=PASS`, `quote_calc_expected_total=2830`, `project_ref=yasprgtlqclwsjcshtls`) |
| 6 | `node scripts/dev/_test-auth-users-matrix.mjs` | **PASS** (`AUTH USERS MATRIX: PASS`) |
| 7 | `node scripts/dev/_qa-auth-functional-local.mjs` | **PASS** (`SUMMARY pass=29 fail=0`) — inclui **R02_2830** e **R03_pdf** `application/pdf` |
| 8 | `npm run build` | **PASS** (`build_exit=0`) |
| 9 | ESLint scoped Auth (`app/login`, `app/auth`, `app/users`, `app/profile`, `Lib/auth`, `components/auth`) | **PASS** (`EXIT_LINT=0`) |

## Evidências-chave

- Total fixture: **2830**
- PDF: **application/pdf** (HTTP 200)
- JWT/RLS cross-tenant: negado
- Auth funcional: **29 PASS / 0 FAIL**
- Build: OK
- Lint Auth: OK
- Arquivos alterados na baseline limpa: nenhum (stash)
- Produção: **não usada**

## Decisão

Baseline **PASS**. Autorizado iniciar inspeção + documentos da entrega Quotes/Orders na branch `feat/quotes-orders-operational-foundation-dev`.

---

*Documento gerado no GATE 0 — sem implementação de Order/OS neste arquivo.*
