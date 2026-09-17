# Multi-tenant architecture

Canonical rules now live in `docs/architecture/multicompany-foundation.md`.
This page is the older implementation sketch and still mentions env-based CDL fallbacks as a legacy phase.

## Hierarchy

| Layer | Table | Purpose |
|-------|-------|---------|
| Franchise Group | `franchise_groups` | Brand / network (e.g. CDL BBQ Network) |
| Company | `companies` | Paying tenant, billing, main data isolation |
| Branch | `branches` | Operational unit inside a company |

**Rules**

- Separate billing → separate **Company**
- Same company, different location → **Branch**
- Multiple companies under one brand → **Franchise Group**

## Data isolation

All commercial data is scoped by `company_id`:

- `quotes`, `customers`, `packages`, `additional_items`
- `package_items`, `package_side_items`, `package_option_groups`
- `commercial_rules`, `feature_flags`, `audit_logs`

Optional `branch_id` (nullable):

- `null` → company-wide catalog/rule
- set → branch-specific override

Catalog queries use:

```
company_id = currentCompany
AND (branch_id IS NULL OR branch_id = currentBranch)
```

## Billing

`subscriptions` is 1:1 with `companies`:

- plan, monthly price, included branches, extra branch price

## Users

`company_memberships` links `user_id` (Supabase Auth) to `company_id` with `role`.

Roles: `owner`, `admin`, `manager`, `sales`, `operator`, `kitchen`, `viewer`.

**Current state:** CDL pilot uses env `CDL_COMPANY_ID` / `NEXT_PUBLIC_CDL_COMPANY_ID`. Auth + membership resolution is the next phase.

## Google Calendar

`resolveCalendarTarget()` in `Lib/tenant/calendar.ts`:

1. Branch calendar if `branch.google_calendar_enabled`
2. Else company calendar
3. Else none

Quotes store `google_calendar_event_id`, `calendar_sync_status`.

## Frontend context

- `TenantProvider` — loads `/api/tenant/context`
- `TenantContextBar` — company name + branch selector
- `useTenant()` — `companyId`, `branchId`, `branches`, `role`, `featureFlags`

Env overrides:

- `NEXT_PUBLIC_CDL_COMPANY_ID`
- `NEXT_PUBLIC_CDL_BRANCH_ID`
- `NEXT_PUBLIC_CDL_USER_ROLE`

## Migration

Run `scripts/sql/multi-tenant-foundation.sql` in Supabase after catalog migrations.

## Implementation roadmap

1. ✅ `company_id` on core tables + env tenant resolver
2. ✅ Foundation tables (franchise, branches, subscriptions, memberships, flags, audit)
3. ✅ Tenant context API + UI bar
4. ✅ Close quote/rules tenant holes in Lib
5. ⏳ Supabase Auth + membership-based tenant
6. ⏳ RLS policies per company
7. ⏳ Branch required on quote when company has multiple branches
8. ⏳ Google Calendar sync on quote confirmation
9. ⏳ Inventory per branch
10. ⏳ Stripe billing webhooks → `subscriptions`
