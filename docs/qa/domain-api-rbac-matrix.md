# Matriz RBAC — APIs de domínio (Catering)

**Branch:** `feat/auth-users-rbac-catering-dev`  
**Supabase DEV:** `yasprgtlqclwsjcshtls`  
**Helper:** `Lib/auth/requireApi.ts` (`requireApiAuth`, `requireApiPermission`, `rejectSpoofedCompanyId`)  
**Catálogo real de permissões:** `users.*`, `quotes.view|manage`, `customers.view|manage`, `catalog.view|manage`, `audit.view`, `support.access`, `company.settings`

Legenda: ✅ permitido · ⛔ 403 · 🔐 401 sem sessão · PA = Platform Admin (conta individual)

| API | Método | Permissão exigida | Owner/Admin | Sales | Operator | Finance | Viewer | PA |
|-----|--------|-------------------|-------------|-------|----------|---------|--------|-----|
| `/api/quotes` | GET | `quotes.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/quotes` | POST | `quotes.manage` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/quotes/[id]` | PATCH/DELETE | `quotes.manage` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/quotes/[id]/pdf` | GET | `quotes.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/customers` | GET | `customers.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/customers` | POST | `customers.manage` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/customers/[id]` | PATCH | `customers.manage` | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/packages` | GET | `catalog.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/packages` | POST | `catalog.manage` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/additional-items` | GET | `catalog.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/additional-items` | POST | `catalog.manage` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/tenant/context` | GET | sessão autenticada | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/users` | GET | `users.view` | ✅ | ⛔ | ⛔ | ⛔* | ⛔ | ✅ |
| `/api/users` | POST | `users.invite`/`manage` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/users/[id]` | PATCH/DELETE | `users.manage` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/auth/support/*` | POST | Platform Admin | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/api/platform/companies` | GET | Platform Admin | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |

\*Finance tem `audit.view` mas **não** `users.view` no seed atual.

Regras adicionais:
- `company_id` no body/query ≠ contexto autorizado → **403**
- sem sessão → **401**
- recurso cross-tenant → RLS / 404 de negócio (não vazar isolamento)
