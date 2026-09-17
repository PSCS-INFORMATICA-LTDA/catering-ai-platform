# Company onboarding readiness

Issue #52 does **not** ship a full onboarding wizard.
This is the configuration map a second tenant (and later PSCS One) needs.

Statuses:

- `READY_SELF_SERVICE` — a company admin can do it in the current UI
- `NEEDS_UI` — data model exists; only staff/SQL can change it
- `NEEDS_FOUNDATION` — missing model, entitlement, or tenant integrity
- `PLATFORM_ADMIN_ONLY` — PSCS / Ricardo / Philippe, not the customer

| Capability | Status | Where today |
|---|---|---|
| Empresa legal/trade name, address, phone, website | READY_SELF_SERVICE | `/settings/company` |
| Logo / brand logo upload | READY_SELF_SERVICE | `/settings/company` |
| Idioma preferido do usuário | READY_SELF_SERVICE | profile / `app_users.preferred_language` |
| Timezone / currency / default language | NEEDS_UI | `companies.timezone`, `currency_code`, `default_language` |
| Branches | NEEDS_UI | `branches` exist; no company admin screen |
| Usuários / convites | READY_SELF_SERVICE | `/users` + memberships |
| Papéis | NEEDS_UI | `app_roles` seeded per company; no editor |
| Permissões | PLATFORM_ADMIN_ONLY | `permissions` / `role_permissions` are global |
| Hero / galeria / conteúdo público | NEEDS_UI | media manager + `company_public_quote_settings.landing_copy`; CDL hero photos are still a seed playlist keyed by slug `cdl` |
| Public quote enabled | NEEDS_UI | `company_public_quote_settings.enabled` |
| Catálogo / categorias / pacotes / guarnições / adicionais / preços | READY_SELF_SERVICE | existing backoffice screens, all `company_id` scoped |
| Mínimo comercial / depósito / mileage / capacity / staff rules | NEEDS_UI | `commercial_rules`, `payment_rules`, `staff_rules` (CDL values are seed, including Caio capacity 4/6/180) |
| Assistant persona / location label | NEEDS_UI | `commercial_rules.assistant_persona` |
| Payment providers / PayPal | READY_SELF_SERVICE | `/settings/payments` + per-company secrets |
| Bank / Zelle copy | NEEDS_UI | provider metadata; must stay company-scoped |
| Notifications / recipients | PLATFORM_ADMIN_ONLY | lives on PR #51, not this branch |
| Terms / consent / privacy URL | NEEDS_UI | `company_public_quote_settings` |
| Coupons | READY_SELF_SERVICE | coupon center is company-scoped |
| PSCS One company mapping | PLATFORM_ADMIN_ONLY | `pscs_one_user_id` + mapped-company cookie |

## Engine leftovers that still need a later pass

These are documented, not all removed in #52, because they would change Caio’s public quote copy or a single-tenant fallback:

| Item | Class | Notes |
|---|---|---|
| `getActiveCompanyId()` → CDL UUID | LEGACY_EXCEPTION | session/membership should replace it; env override remains for this DEV deploy |
| `CDL_DEFAULT_COMPANY_ID` | SEED_OK / TEST_FIXTURE | keep for seeds and QA, not for request logic |
| Public quote hero playlist keyed by slug `cdl` | SEED_OK / NEEDS_FOUNDATION | other companies get no photos until media settings exist |
| Quote proposal footer “Orlando, Florida” | REMOVE_HARDCODE | left untouched so Caio’s public quote copy stays stable |
| `INVOICE_SNAPSHOT_VERSION = CDL_INVOICE_SNAP_2026_V1` | LEGACY_EXCEPTION | renaming would invalidate stored snapshots |
| `NEXT_PUBLIC_CDL_*` env | PLATFORM_DEFAULT | DEV alias / pilot only |

## What a tenant #2 can do after this delivery

1. Exist as a real `companies` row (Company B already does: isolation / QA MULTICOMPANY).
2. Receive memberships, roles, and document sequences without a sentinel UUID.
3. Keep catalog/quotes/invoices/Brasinha structurally unable to point at another company.
4. Configure assistant name/location through `commercial_rules` instead of a UUID `if`.
5. Still need a human (or a future wizard) to fill branding, public quote, commercial rules, and payment credentials.
