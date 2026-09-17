# Company onboarding readiness

Issue #52 does **not** ship a full onboarding wizard.
This is the configuration map a second tenant (and later PSCS One) needs.

The question for each capability:

> Para cadastrar a segunda empresa, Philippe ou Ricardo precisa alterar código ou executar SQL?

If **yes** for a normal business setting: `NEEDS_UI` or `NEEDS_FOUNDATION`.

Statuses:

- `READY_SELF_SERVICE` — a company admin can do it in the current UI
- `NEEDS_UI` — data model exists; only staff/SQL can change it
- `NEEDS_FOUNDATION` — missing model, entitlement, or tenant integrity
- `PLATFORM_ADMIN_ONLY` — PSCS / Ricardo / Philippe, not the customer

| Capability | Status | Code/SQL for tenant #2? | Where today |
|---|---|---|---|
| Create company row | NEEDS_UI | SQL today | no wizard |
| Locale / timezone / currency | NEEDS_UI | SQL or future settings | `companies.timezone`, `currency_code`, `default_language` |
| Branch | NEEDS_UI | SQL | `branches` exist; no company admin screen |
| Branding / logo | READY_SELF_SERVICE | No | `/settings/company` |
| Users / memberships | READY_SELF_SERVICE | No | `/users` + memberships |
| Public quote | NEEDS_UI | SQL flag | `company_public_quote_settings.enabled` |
| Catalog / categories / packages / pricing | READY_SELF_SERVICE | No | existing backoffice screens, `company_id` scoped |
| Commercial rules / capacity / deposit / mileage | NEEDS_UI | SQL seed today | `commercial_rules`, `payment_rules`, `staff_rules` |
| Payment providers | READY_SELF_SERVICE | No | `/settings/payments` |
| Notification recipients | PLATFORM_ADMIN_ONLY | lives on PR #51 | not this branch |
| Publish / go-live | NEEDS_UI | SQL | public quote + catalog + payments |

Desired future setup (not built here):

```
Create Company
  → locale
  → timezone
  → currency
  → branch
  → branding
  → users/memberships
  → public quote
  → catalog
  → categories
  → packages
  → pricing
  → commercial rules
  → capacity
  → payment providers
  → notification recipients
  → publish
```

## Engine leftovers still classified (not all removed)

| Item | Class | Notes |
|---|---|---|
| `CDL_DEFAULT_COMPANY_ID` | TEST_FIXTURE / TENANT_SEED_OK | seeds and QA only |
| Explicit `NEXT_PUBLIC_CDL_COMPANY_ID` / `CDL_COMPANY_ID` | PLATFORM_DEFAULT | DEV override; no silent UUID |
| `getActiveCompanyId()` without env | REMOVE_FROM_ENGINE | now fail-closed (`company_context_required`) |
| Public quote hero playlist keyed by slug `cdl` | TENANT_SEED_OK / NEEDS_FOUNDATION | other companies get no photos until media settings exist |
| Quote proposal location | COMPANY_SETTING | derived from company/branch/`assistant_persona` |
| `INVOICE_SNAPSHOT_VERSION = CDL_INVOICE_SNAP_2026_V1` | LEGACY_EXCEPTION | renaming would invalidate stored snapshots |
| `cdlCommercialRules` numeric fallbacks | REMOVE_FROM_ENGINE | still used if DB fetch fails; do not change Caio pricing in this round |
| `www.cdlbbq.com` PDF website | COMPANY_SETTING | PDF now takes optional website; no default CDL domain |

## What a tenant #2 can do after this delivery

1. Exist as a real `companies` row (Company B already does: isolation / QA MULTICOMPANY).
2. Receive memberships, roles, and document sequences without a sentinel UUID (`scripts/dev/setup-multicompany-company-b.mjs`).
3. Keep catalog/quotes/invoices/Brasinha/agenda/inventory structurally unable to point at another company (after Philippe applies migrations).
4. Configure assistant name/location through `commercial_rules` / company address instead of a UUID `if`.
5. Still need a human (or a future wizard) to fill branding, public quote, commercial rules, and payment credentials.
