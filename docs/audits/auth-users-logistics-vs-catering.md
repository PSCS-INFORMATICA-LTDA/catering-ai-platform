# Auditoria — Autenticação e Usuários: Logistics AI (GRX) × Catering AI

**Produto destino:** Catering AI Platform  
**Referência (somente leitura):** Logistics AI / GRX — `D:\PSCS\Projetos\grx-management`  
**Baseline Catering:** commit `acd4000` · branch `feat/auth-users-rbac-catering-dev`  
**Supabase DEV:** `yasprgtlqclwsjcshtls`  
**Data:** 2026-08-03  

## Controles

- Logistics **não** foi alterado.
- Não copiar domínio de frota, veículos, motoristas, estacionamento ou lava-rápido.
- Reutilizar somente padrões genéricos: Auth SSR, membership, RBAC, convite, last-admin, auditoria.
- **Proibido:** senha master universal, bypass escondido, acesso sem autenticação.
- Platform Admin = conta individual + sessão normal + suporte auditado (motivo obrigatório).

## Premissas de schema Catering já aplicadas (não reexecutar)

- `20260731153000_f1_identity_memberships.sql` — `app_users.auth_user_id`, `company_memberships`, `app_roles`
- `20260803210000_harden_multitenant_rls.sql` — RLS por membership

## Matriz

| Feature | Logistics | Evidência Logistics | Catering atual | Evidência Catering | Gap | Decisão |
|--------|-----------|---------------------|----------------|--------------------|-----|---------|
| Login | **TEM** | `frontend/src/app/login/page.tsx` — `signInWithPassword` | **NÃO TEM** | Sem `/login`; matriz maturidade Auth=NÃO TEM | Paridade Auth e-mail/senha | Implementar `/login` + redirect `?next=` |
| Logout | **TEM** | `frontend/src/components/layout/Header.tsx` — `signOut` | **NÃO TEM** | Sem `signOut` na UI | Logout explícito | Header/menu + limpar sessão suporte |
| Sessão (cookies/SSR) | **TEM** | `@supabase/ssr` — `lib/supabase/{client,server,middleware}.ts` | **NÃO TEM** | `Lib/supabase.ts` anon; sem `@supabase/ssr` | Sessão cookie + refresh | Adotar `@supabase/ssr` (browser/server/middleware) |
| Middleware / proxy | **TEM** | `frontend/src/middleware.ts` + `updateSession` | **NÃO TEM** | Sem `middleware.ts` | Gate global | Middleware: público vs backoffice; refresh JWT |
| Proteção de páginas | **TEM** | middleware + `ScreenAccessGate` + `access-server.ts` | **NÃO TEM** | Rotas `/quotes`, `/customers` abertas | Redirect login + RBAC tela | Gate por sessão + permissão de tela |
| Proteção de APIs | **PARCIAL** | `requireCompanyMember` em parte das APIs | **NÃO TEM** | `app/api/**` sem `getUser`/401 | JWT obrigatório nas APIs privadas | Helper `requireAuth` / `requirePermission` |
| Recuperação de senha | **TEM** | login forgot + `auth/callback` + `auth/redefinir-senha` | **NÃO TEM** | Só docs Fase1 F1.2 | Fluxo reset Supabase | `/auth/forgot-password`, callback, `/auth/reset-password` |
| Troca de senha autenticada | **NÃO TEM** | Só recovery; sem UI “alterar senha” logado | **NÃO TEM** | — | Ambos sem UI logada | Implementar em `/profile` (`updateUser`) — Catering avança além do GRX |
| Perfil do usuário | **PARCIAL** | tabela `profiles` + trigger; sem página “Meu perfil” | **NÃO TEM** | `app_users` schema sem UI | Página perfil | `/profile` edita `app_users` + idioma + senha |
| Administração de usuários | **TEM** | `configuracoes/usuarios/page.tsx` | **NÃO TEM** | Sem `/users` | CRUD membership | `/users` listar/convidar/papel/status |
| Convites | **TEM** | `api/company/members/invite` — `inviteUserByEmail` (sem tabela) | **NÃO TEM** | Planejado Fase1 F1.6 | Convite + rastreio | `user_invites` + API invite (service role) |
| Memberships | **TEM** | `company_members` + company-context | **PARCIAL** | Tabela `company_memberships` + RLS; app usa env tenant | Resolver tenant pela membership | Sessão → membership ativa → `company_id`/role |
| Papéis (roles) | **TEM** | roles em membership (admin/operacional/…) | **PARCIAL** | `app_roles` seed + CHECK; `Lib/tenant/roles.ts` unused | UI + enforcement | Roles Catering: owner/admin/manager/sales/operator/kitchen/finance/viewer |
| Permissões | **TEM** | `partner_screen_permissions` por tela | **NÃO TEM** | Só helpers rank em `roles.ts` | Catálogo de permissões | `permissions` + `role_permissions` + checagem server/UI |
| Ativação | **NÃO TEM** | Sem toggle member active | **PARCIAL** | Colunas `active` em `app_users`/`company_memberships` | UI/API activate | Toggle `membership.active` / `app_users.active` |
| Inativação | **NÃO TEM** | — | **PARCIAL** | Colunas existem | UI/API deactivate | Mesmo fluxo; bloquear auto-inativação crítica |
| Suspensão | **NÃO TEM** | — | **NÃO TEM** | — | Status suspend | `membership.status` ou flag `suspended_at` + bloqueio login/tenant |
| Exclusão / remoção controlada | **PARCIAL** | Audit de delete de entidades; UI users sem remove | **NÃO TEM** | — | Remover membership com motivo | Soft-remove membership + audit; nunca apagar `auth.users` sem regra |
| Último owner | **TEM** | `setCompanyMemberRole` / UI `adminCount <= 1` | **NÃO TEM** | — | Proteger último owner/admin | Regra app + API: não demote/remove último `owner`/`admin` |
| Auditoria administrativa | **PARCIAL** | `deletion_audit_events` (domínio delete) | **PARCIAL** | Tabela `audit_logs` + RLS; zero writers TS | Eventos auth/admin | Writers em `audit_logs` / `admin_audit_events` (invite, role, support) |
| Platform Admin | **NÃO TEM** | Sem console cross-tenant | **PARCIAL** | `app_users.is_pscs_master` coluna; sem UI | Console plataforma | Conta individual `is_pscs_master`; seletor company auditado |
| Suporte PSCS | **PARCIAL** | allowlist e-mail só billing | **NÃO TEM** | — | Impersonação controlada | `support_access_sessions`: motivo, início/fim, banner, audit; **sem** ver senha do cliente |
| PT / EN / ES | **NÃO TEM** | UI pt-BR fixo | **NÃO TEM** (auth) | Labels `app_roles` PT/EN/ES only | i18n auth/admin | Dicionário auth/users PT/EN/ES (mínimo) |
| Mobile | **PARCIAL** | Shell responsivo | **NÃO TEM** (auth) | Help safe-area only | Login/admin usáveis em mobile | Layout auth responsivo; menus touch |
| Testes automatizados auth | **PARCIAL** | scripts manuais SQL/mjs | **NÃO TEM** | Sem vitest/playwright auth | Scripts + checks | Script DEV matriz auth + manter JWT/RLS + verify funcional |

## Padrões reutilizáveis do Logistics (genéricos)

1. **Supabase SSR** — `createBrowserClient` / `createServerClient` / middleware cookie refresh.  
2. **Gate de rota** — público vs autenticado; redirect `?next=`.  
3. **Membership como tenant** — company/role da sessão, não env.  
4. **Invite via service role** — `inviteUserByEmail` + insert membership (Catering: + tabela `user_invites`).  
5. **Last admin/owner** — contagem antes de demote/remove.  
6. **Screen/permission gate** — adaptar para permissões Catering (sem `partner_id` de frota).

## Padrões **não** reutilizar

- Senha master da empresa / sessionStorage unlock.  
- Allowlist PSCS só para billing como “suporte”.  
- Domínio frota/parceiro/estacionamento.  
- Setup “criar empresa no primeiro login” (Catering: companies já existem; convite/membership).

## Decisões de implementação Catering (esta entrega)

| Tema | Decisão |
|------|---------|
| Auth provider | Supabase Auth e-mail/senha |
| Sessão | `@supabase/ssr` cookies |
| Tenant runtime | Membership ativa (`company_memberships`) + opcional Platform Admin com company selecionada |
| Platform Admin | `app_users.is_pscs_master`; autenticação normal; sem senha universal |
| Suporte | Tabela `support_access_sessions` + banner + audit obrigatório |
| Permissões | Migration `permissions` + `role_permissions` (seed); enforcement server + UI |
| Convites | `user_invites` + API admin |
| Suspensão | `company_memberships.status` (`active`/`inactive`/`suspended`) mantendo coluna `active` sincronizada |
| Migrations F1/harden | **Não alterar**; só migration nova desta feature |
| i18n | Módulo leve `Lib/i18n/authUsers.ts` PT/EN/ES para strings auth/admin |
| Preview | Login real para validação Philippe; sem merge main / sem `--prod` |

## Estruturas de banco previstas (nova migration)

Somente se ausentes no schema DEV:

- `public.permissions`
- `public.role_permissions`
- `public.user_invites`
- `public.support_access_sessions`
- extensão/`status` em memberships se necessário
- policies RLS alinhadas a `private.is_company_member` / roles admin
- sem DROP TABLE; sem tocar PROD

## Ordem de entrega técnica

1. Doc desta matriz ✅  
2. Migration + seeds permissões/invites/support  
3. Clients SSR + middleware + `requireAuth`  
4. Telas login / forgot / reset / change password / profile  
5. Admin users + last owner + activate/suspend/remove  
6. Platform Admin + support session + audit writers  
7. i18n + responsivo  
8. Testes + Preview  

## Status desta auditoria

**MATRIZ CONCLUÍDA** — pronta para implementação na branch `feat/auth-users-rbac-catering-dev`.
