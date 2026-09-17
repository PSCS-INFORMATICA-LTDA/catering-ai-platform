# Tenant isolation — DEV

Project: `yasprgtlqclwsjcshtls`  
PROD (`eapwtirhevxrqinytans`) is not touched.  
Official alias `catering-ai-agenda-dev.vercel.app` is not rebound.

## Companies

| Role | id | code | name |
|---|---|---|---|
| Company A | `65fd576f-8d97-49ba-bf38-61bc1e94e94a` | CDL | CDL Services BBQ At Home |
| Company B | `a1111111-1111-4111-8111-111111111111` | TEST-DEV-ISO | TESTE DEV — Empresa Isolamento (`trade_name` QA MULTICOMPANY) |

Company B is the existing isolation tenant. Issue #52 does not insert a fake/sentinel company.

## How to prove isolation

```bash
node scripts/dev/test-tenant-isolation-ab.mjs
```

The harness:

1. Creates JWT users A (CDL viewer) and B (QA viewer) via Admin API.
2. Seeds rollbackable `QA-MC-*` rows (customer, package, quote, invoice, payment, Brasinha).
3. Signs in with the anon key (not service_role).
4. Asserts A cannot SELECT/INSERT/UPDATE/DELETE B, then the inverse.
5. Deletes the fixtures and users.

`service_role` is setup/teardown only. A green frontend walk is not a PASS.

Also:

```bash
node --experimental-strip-types --test Lib/tenant/companyPublicBrand.test.mjs Lib/tenant/multicompanyFoundation.test.mjs
npm test
npx tsc --noEmit
node scripts/dev/apply-multicompany-hardening-dev.mjs
```

## AUDIT_BEFORE (live DEV 2026-09-17)

Raw dump: `docs/qa/multicompany-audit-before.json`  
Lineage: `docs/qa/multicompany-lineage-before.json`

### Table matrix (public base / exposed relations)

classification: `tenant` | `global_reference` | `platform` | `tenant_root`

| table_name | classification | company_id | nullable | rows | null cid | orphan | sentinel | action |
|---|---|---|---|---|---|---|---|---|
| companies | tenant_root | no (id) | n/a | 2 | | | | keep |
| app_users | platform | yes | yes | 14 | 10 | 0 | 0 | FK SET NULL; do not backfill |
| users | platform | yes | yes | 0 | 0 | | 0 | leftover; FK optional |
| company_memberships | tenant | yes | no | 14 | 0 | 0 | 0 | already FK |
| app_roles | tenant | yes | no | 16 | 0 | 0 | 0 | add FK |
| permissions | global_reference | no | | 42 | | | | platform catalog |
| role_permissions | global_reference | no | | 170 | | | | platform map |
| languages | global_reference | no | | 0 | | | | SELECT authenticated |
| franchise_groups | global_reference | no | | 2 | | | | SELECT authenticated |
| inventory_movement_types | global_reference | yes | yes | 7 | 7 | 0 | 0 | codebook; no NOT NULL |
| document_sequences | tenant | yes | no | 5 | 0 | 0 | 1 | freeze sentinel; FK deferred |
| customers | tenant | yes | openapi yes | 246 | 0 | 0 | 0 | add FK |
| catalog_items | tenant | yes | openapi yes | 115 | 0 | 0 | 0 | add FK |
| catalog_item_prices | tenant | yes | openapi yes | 121 | 0 | 0 | 0 | add FK |
| packages | tenant | yes | openapi yes | 13 | 0 | 0 | 0 | add FK + unique(id,company) |
| package_categories | tenant | yes | openapi yes | 4 | 0 | 0 | 0 | add FK |
| package_items | tenant | yes | openapi yes | 100 | 0 | 0 | 0 | add FK |
| package_option_groups | tenant | yes | no | 32 | 0 | 0 | 0 | add FK |
| package_option_values | tenant | yes | no | 20 | 0 | 0 | 0 | add FK |
| media_assets | tenant | yes | no | 25 | 0 | 0 | 0 | add FK |
| commercial_rules | tenant | yes | yes | 20 | 0 | 0 | 0 | add FK; keep NULL for global fallback |
| payment_rules | tenant | yes | no | 9 | 0 | 0 | 0 | add FK |
| staff_rules | tenant | yes | no | 8 | 0 | 0 | 0 | add FK |
| quote_text_templates | tenant | yes | no | 5 | 0 | 0 | 0 | add FK |
| quote_statuses | tenant | yes | no | 0 | 0 | | 0 | add FK |
| quotes | tenant | yes | no | 11 | 0 | 0 | 0 | add FK + composite children |
| quote_versions | tenant | yes | no | 12 | 0 | 0 | 0 | composite → quotes |
| quote_items | tenant | yes | no | 0 | 0 | | 0 | composite → quotes |
| quote_additional_items | tenant | yes | no | 25 | 0 | 0 | 0 | composite → quotes |
| quote_package_selections | tenant | yes | no | 30 | 0 | 0 | 0 | composite → quotes |
| quote_package_items | tenant | yes | no | 0 | 0 | | 0 | composite → quotes |
| quote_option_selections | tenant | yes | no | 0 | 0 | | 0 | composite → quotes |
| invoices | tenant | yes | no | 10 | 0 | 0 | 0 | already composite |
| invoice_payments | tenant | yes | no | 17 | 0 | 0 | 0 | already composite |
| invoice_refunds | tenant | yes | no | 0 | 0 | | 0 | already composite |
| invoice_payment_links | tenant | yes | no | 35 | 0 | 0 | 0 | already composite |
| payment_schedule_holds | tenant | yes | no | 14 | 0 | 0 | 0 | SAFE_AS_IS server-only |
| public_quote_intake_sessions | tenant | yes | no | 10 | 0 | 0 | 0 | SAFE_AS_IS server-only |
| public_quote_rate_limits | tenant | yes | no | 28 | 0 | 0 | 0 | SAFE_AS_IS server-only |
| inventory_document_sequences | tenant | yes | no | 3 | 0 | 0 | 0 | SAFE_AS_IS server-only |
| brasinha_conversations | tenant | yes | no | 24 | 0 | 0 | 0 | already composite |
| brasinha_messages | tenant | yes | no | 289 | 0 | 0 | 0 | already composite |
| v_package_id | needs_analysis | no | | 0 | | | | DEFERRED view |
| support_access_sessions | platform | target_company_id | | 9 | | | | platform support |

Views (`quote_detail_view`, `inventory_availability`, `vw_customer_display`) inherit invoker RLS.

## RLS advisor disposition

| Object | Disposition | Reason |
|---|---|---|
| payment_schedule_holds | SAFE_AS_IS | grants revoked; service-role RPCs only |
| public_quote_intake_sessions | SAFE_AS_IS | token hash, server-only |
| public_quote_rate_limits | SAFE_AS_IS | server-only |
| inventory_document_sequences | SAFE_AS_IS | already documented |
| languages | FIXED | authenticated SELECT, no writes |
| franchise_groups | FIXED | authenticated SELECT, no writes |
| v_package_id | DEFERRED_WITH_REASON | compatibility relation; dummy policy would hide the real question |

Do not add policies just to zero the advisor.

## SECURITY DEFINER review

| RPC | Verdict |
|---|---|
| Public token RPCs (`get_public_*`, `respond_to_*`, `confirm_*`, `finalize_public_quote`, `consume_public_quote_rate_limit`) | keep; token-hash, company derived server-side |
| `get_public_quote_proposal` | deprecated separately; still token-based |
| Inventory / document allocators (`get_next_document_number`, `next_inventory_document_number`, `post_inventory_*`, `rebuild_inventory_balances`, …) | already service_role only; #52 adds sentinel/company existence guard on `get_next_document_number` |
| Finance RPCs (`record_manual_invoice_payment`, `reconcile_invoice_ledger`, refunds, outbox, schedule hold) | keep; company from invoice/quote, not from the browser |
| PayPal secret vault | service_role only |
| `ensure_quote_proposal_token` and staff proposal helpers | authenticated + `_assert_quote_member` |

No public token may switch `company_id`.

## Hardcodes

| Occurrence | Class |
|---|---|
| CDL seeds, logos under `public/cdl`, catalog scripts | SEED_OK |
| `commercial_rules` deposit/mileage/capacity including 4 events / 6 teams / 180 minutes | SEED_OK / COMPANY_SETTING |
| `assistant_persona` Brasinha + Orlando, Florida | COMPANY_SETTING (seeded for CDL) |
| Invoice PDF title/location | REMOVE_HARDCODE (now company brand) |
| Brasinha UUID switch | REMOVE_HARDCODE |
| Help branding UUID/logo fallback | REMOVE_HARDCODE |
| Quote proposal “Orlando, Florida” | REMOVE_HARDCODE (deferred; Caio quote copy) |
| `getActiveCompanyId` CDL fallback | LEGACY_EXCEPTION |
| QA scripts using CDL / isolation UUIDs | TEST_FIXTURE |
| Sentinel UUID in payment QA as dummy id | TEST_FIXTURE |

## Advisors

Advisors cannot be re-run from this environment (no `SUPABASE_ACCESS_TOKEN`). After the versioned migrations are applied on DEV, re-run Database/Security/Performance advisors and attach the after-report here. Cosmetic “add 119 indexes” remains out of scope.

## Performance choices

Only tenant-key / new-FK / finance / quote-order covering indexes were added.
Duplicate indexes were not dropped (definitions not byte-compared on live DEV).
Multiple permissive policies were not merged.
