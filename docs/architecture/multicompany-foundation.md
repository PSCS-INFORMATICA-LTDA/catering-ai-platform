# Multi-company foundation

Any business-owned entity belongs to a tenant explicitly.
Global/platform reference data is explicitly global.
Fake/sentinel company IDs are forbidden.
Cross-tenant relationships must be structurally prevented.
Normal company setup must not require source-code changes.

## Permanent rule

```
empresa
  → filial opcional
  → configuração
  → dados transacionais
  → permissões
  → auditoria
```

A value that changes between companies is one of:

- company setting
- branch setting
- product entitlement / platform setting

It is never a CDL constant in engine code.

## Identity

Preferred model:

```
auth.users          global login
app_users           platform person (company_id nullable, legacy hint only)
company_memberships one row per (user, company)
is_pscs_master      platform/support flag, not a tenant role
users               empty legacy table
```

Do not model “a user must belong to exactly one company”.
PSC S master / support access uses `is_pscs_master` + `support_access_sessions`.

DEV audit (2026-09-17, `yasprgtlqclwsjcshtls`):

- 14 `app_users`
- 10 `company_id` NULL (1 `is_pscs_master`, 9 `role_key=user` QA/filter accounts)
- 4 with `company_id` (CDL operational users)
- 14 memberships, all on CDL
- `users` table empty

Action: do **not** backfill `app_users.company_id`.

## Global vs tenant

| Classification | Examples | `company_id` |
|---|---|---|
| tenant_root | `companies` | n/a (`id`) |
| tenant | quotes, invoices, catalog, media, agenda, inventory docs, Brasinha | required |
| global_reference | `languages`, `permissions`, `role_permissions`, `inventory_movement_types` (NULL = codebook) | absent or NULL |
| tenant_hierarchy | `franchise_groups` | absent — visible only via companies the caller belongs to, or platform master |
| platform | `app_users`, `support_access_sessions`, `admin_audit_events` | optional |

`inventory_movement_types` is a global codebook today (7 rows, all `company_id` NULL). Future per-company codes use the existing unique `(company_id, code)` index. Do not force `NOT NULL`.

## Sentinel UUID

`00000000-0000-4000-8000-000000000000` is not a company.

Live DEV still has one `document_sequences` row:

- type `service_order` / prefix `SO` / year 2026 / `current_number=13`
- last written 2026-08-27
- CDL has its own live SO sequence at `9` (updated 2026-09-17)
- surviving OS numbers are `SO-2026-000004`…`000009`, all CDL
- numbers 1–3 and 10–13 have no surviving documents

Result: **RETAINED_INACTIVE_PENDING_LINEAGE**. The row is deactivated. It is not deleted or reassigned. It is frozen legacy data, not a tenant. New sentinel allocations are rejected (`private.reject_sentinel_company_id` + `get_next_document_number` requires a real `companies.id`). The `document_sequences.company_id` FK is deferred until a human retires that row. Do not create another fake tenant to replace it.

## Structural isolation

Membership RLS (`private.is_company_member`) is necessary but not sufficient.

Child rows must satisfy `child.company_id = parent.company_id` via composite foreign keys `(company_id, parent_id)` on quote, order, invoice, inventory, catalog/package, agenda, and Brasinha graphs.

Finance already had composite FKs from `20260911153500_finance_tenant_integrity.sql`.
Brasinha already had `(conversation_id, company_id)`.
Round 1 (`20260917202000`) covered quote/order children.
Round 2 (`20260917204000`) covers quotes → customer/event/package, catalog/package graph, agenda, inventory, public intake, and operations. SET NULL refs use `private.assert_same_company_ref` so `company_id` is never nulled.

QA Company B seed is **not** a product migration. Use `scripts/dev/setup-multicompany-company-b.mjs`.

## Configuration-first

New companies are configured with data, not deploys:

- `companies` branding / timezone / currency / language
- `company_public_quote_settings`
- `commercial_rules` (deposit, mileage, capacity, `assistant_persona`)
- `payment_rules`, `staff_rules`
- `company_payment_providers` + `private.payment_provider_secrets`
- memberships and `app_roles`

CDL remains the pilot seed. Removing CDL from the engine is not the same as deleting CDL data.

## Out of scope here

- Full onboarding wizard
- Notification Center (PR #51)
- Official DEV alias rebind
- Production schema
- Product rename / PWA / new AI Secretary
