# Plano de Testes — Autenticação e Usuários (Catering AI)

**Produto:** Catering AI Platform  
**Branch:** `feat/auth-users-rbac-catering-dev`  
**Commit baseline entrega:** `6a3539e`  
**Supabase DEV:** `yasprgtlqclwsjcshtls`  
**Preview alvo:** `https://catering-ai-platform-2weg655c4-pscs-informatica-ltda-s-projects.vercel.app` (target Preview, Ready)  
**Data do plano:** 2026-08-03  

## Controles

- Produção (`eapwtirhevxrqinytans`) proibida.
- Sem `vercel --prod`, merge main, db reset, senha universal.
- Sessões reais (JWT) para provas de permissão; service-role só para fixture DEV.
- Sem impressão de senhas, JWT, cookies ou service-role.

## Rotas reais encontradas

| Área | Rota real | Notas |
|------|-----------|-------|
| Home | `/` | Protegida pelo proxy (não pública) |
| Login | `/login` | Público |
| Forgot | `/auth/forgot-password` | Público (não `/forgot-password`) |
| Reset | `/auth/reset-password` | Público |
| Callback | `/auth/callback` | Público |
| Perfil | `/profile` | Protegida; troca de senha na mesma página |
| Usuários | `/users` | Protegida; Platform Admin + suporte na mesma UI |
| Quotes/Customers/Packages/Additionals | `/quotes` … | Protegidas |
| APIs auth | `/api/auth/me`, `logout`, `support/start`, `support/end` | |
| APIs users/profile/platform | `/api/users`, `/api/users/[id]`, `/api/profile`, `/api/platform/companies` | |
| Domínio | `/api/quotes`, `/api/customers`, `/api/packages`, … | Gate no proxy; sem checagem RBAC fina no handler |

Ausentes nesta entrega: `/profile/security`, `/settings/users`, `/settings/audit`, `/platform/companies` (página), `/forgot-password` (alias).

## Matriz de cenários

| ID | Ambiente | Perfil | Cenário | Esperado | Método | Evidência | Status |
|----|----------|--------|---------|----------|--------|-----------|--------|
| A01 | Local+Preview | anon | Preflight DEV | branch/env DEV | git/env | log | PLANNED |
| A02 | Local+Preview | anon | `/login` abre | 200 + form | HTTP/UI | status | PLANNED |
| A03 | Local+Preview | anon | `/` sem sessão | público OU redirect seguro documentado | HTTP | status/Location | PLANNED |
| A04 | Local+Preview | anon | `/quotes` `/profile` `/users` | redirect `/login?next=` | HTTP | Location | PLANNED |
| A05 | Local+Preview | anon | APIs privadas | 401 sem body de negócio | HTTP | status/body | PLANNED |
| A06 | Local | anon | Open redirect `next=//evil` | bloqueado | HTTP/code review | Location | PLANNED |
| B01 | Local | admin | Login inválido | mensagem neutra | Auth API | PASS/FAIL | PLANNED |
| B02 | Local | admin | Login válido | sessão + membership | Auth API + `/api/auth/me` | PASS/FAIL | PLANNED |
| B03 | Local | admin | Persistência | refresh mantém | cookie session | PASS/FAIL | PLANNED |
| B04 | Local | admin | Logout | 401 em APIs | HTTP | PASS/FAIL | PLANNED |
| C01 | Local | admin | Forgot password | resposta neutra; sem e-mail real | UI/API | PASS/FAIL | PLANNED |
| C02 | Local | admin | Reset controlado | link admin/dev; senha restaurada | Auth admin | PASS/FAIL | PLANNED |
| C03 | Local | admin | Troca senha perfil | update; sem current password? | API/UI | PASS/FAIL | PLANNED |
| D01 | Local | admin | Lista `/users` | só empresa principal | API | PASS/FAIL | PLANNED |
| D02 | Local | admin | Invite fixture `@example.test` | invite row / membership | API | PASS/FAIL | PLANNED |
| D03 | Local | admin | Last owner | 409 `last_owner_protected` | API | PASS/FAIL | PLANNED |
| D04 | Local | admin | Self delete | 409 `self_delete_blocked` | API | PASS/FAIL | PLANNED |
| D05 | Local | admin | Status suspend/inactive | update + auditoria | API | PASS/FAIL | PLANNED |
| E01 | Local | sales/viewer fixture | `/api/users` manage | 403 | JWT real | PASS/FAIL | PLANNED |
| E02 | Local | admin | Não cria Platform Admin via membership | sem campo/negado | API | PASS/FAIL | PLANNED |
| E03 | Local | AuthSessionBar | Link Users a todos | deveria respeitar `users.view` | UI | PASS/FAIL | PLANNED |
| F01 | Script | JWT | RLS matrix | PASS | `_test-rls-jwt-matrix.mjs` | PASS/FAIL | PLANNED |
| F02 | Script | — | Verify functional 2830 | PASS | npm script | PASS/FAIL | PLANNED |
| G01 | Local | platform_admin | Support sem motivo | 400 | API | PASS/FAIL | PLANNED |
| G02 | Local | platform_admin | Support com motivo | banner + audit | API/UI | PASS/FAIL | PLANNED |
| G03 | Local | company_admin | Support start | 403 | API | PASS/FAIL | PLANNED |
| H01 | Code/UI | — | PT/EN/ES telas | locale aplicado | code/UI | PASS/FAIL | PLANNED |
| H02 | UI | — | Mobile login/users | usável | viewport | PASS/FAIL | PLANNED |
| I01 | Preview | anon+admin | Smoke auth + regressão | Ready DEV | vercel curl | PASS/FAIL | PLANNED |
| J01 | — | — | Build/lint feature | 0 errors | npm | PASS/FAIL | PLANNED |

## Scripts de execução

- `scripts/dev/_test-auth-users-matrix.mjs` — login/logout básico
- `scripts/dev/_test-rls-jwt-matrix.mjs` — RLS
- `scripts/dev/_qa-auth-users-full.mjs` — bateria ampliada (JWT real + fixture)
- `npm run verify:dev:functional`
- `npm run build` / `npm run lint` (scoped)

## Critério de status final

Somente após preenchimento de `docs/qa/auth-users-test-results.md` com evidências:

- `PRONTO PARA VALIDAÇÃO DE PHILIPPE — AUTENTICAÇÃO E USUÁRIOS`, ou  
- `BLOQUEADO — motivo`.
