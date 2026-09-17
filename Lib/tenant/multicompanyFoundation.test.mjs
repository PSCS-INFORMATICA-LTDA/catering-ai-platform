import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const fk = read('supabase/migrations/20260917201000_multicompany_tenant_fks.sql')
const composite = read('supabase/migrations/20260917202000_multicompany_composite_integrity.sql')
const config = read('supabase/migrations/20260917203000_multicompany_config_rls_and_qa_b.sql')
const round2 = read('supabase/migrations/20260917204000_multicompany_composite_integrity_round2.sql')
const companyB = read('scripts/dev/setup-multicompany-company-b.mjs')
const structural = read('scripts/dev/test-tenant-structural-integrity-ab.mjs')
const foundation = read('docs/architecture/multicompany-foundation.md')
const persona = read('Lib/brasinha/persona.ts')
const invoicePdf = read('components/payments/InvoicePdfDocument.tsx')
const harness = read('scripts/dev/test-tenant-isolation-ab.mjs')
const resolveTenant = read('Lib/tenant/resolveTenant.ts')

test('foundation docs declare the permanent multi-company rule', () => {
  assert.match(foundation, /Any business-owned entity belongs to a tenant explicitly/)
  assert.match(foundation, /Fake\/sentinel company IDs are forbidden/)
  assert.match(foundation, /Cross-tenant relationships must be structurally prevented/)
  assert.match(foundation, /Normal company setup must not require source-code changes/)
})

test('sentinel sequence is frozen, not deleted or reassigned', () => {
  assert.match(fk, /SET active = false/)
  assert.match(fk, /reject_sentinel_company_id/)
  assert.match(fk, /sentinel company IDs are forbidden/)
  assert.doesNotMatch(fk, /DELETE FROM public\.document_sequences/)
  assert.doesNotMatch(
    fk,
    /company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'[\s\S]{0,80}00000000-0000-4000-8000-000000000000/,
  )
  assert.doesNotMatch(fk, /add_company_fk_if_safe\('document_sequences'/)
})

test('tenant FKs use RESTRICT for transactional tables and SET NULL for app_users', () => {
  assert.match(fk, /app_users_company_id_fkey/)
  assert.match(fk, /add_company_fk_if_safe\('app_users', 'app_users_company_id_fkey', 'SET NULL', true\)/)
  assert.match(fk, /quote_additional_items_company_id_fkey/)
  assert.match(fk, /media_assets_company_id_fkey/)
  assert.match(fk, /ON DELETE RESTRICT/)
})

test('composite FKs cover quote, order, inventory and closeout graphs', () => {
  assert.match(composite, /quote_versions_quote_company_fkey/)
  assert.match(composite, /quote_additional_items_quote_company_fkey/)
  assert.match(composite, /service_orders_quote_company_fkey/)
  assert.match(composite, /service_order_items_order_company_fkey/)
  assert.match(composite, /inventory_document_lines_document_company_fkey/)
  assert.doesNotMatch(composite, /ON DELETE CASCADE[\s\S]{0,40}invoices/)
})

test('Company B QA seed lives in scripts/dev, not product migrations', () => {
  assert.doesNotMatch(config, /a1111111-1111-4111-8111-111111111111/)
  assert.doesNotMatch(config, /QA MULTICOMPANY/)
  assert.match(companyB, /a1111111-1111-4111-8111-111111111111/)
  assert.match(companyB, /QA MULTICOMPANY/)
  assert.doesNotMatch(companyB, /INSERT INTO public\.companies/)
  assert.match(config, /assistant_persona/)
  assert.match(config, /SAFE_AS_IS/)
  assert.match(config, /is_company_member/)
  assert.doesNotMatch(config, /franchise_groups_select_authenticated[\s\S]+USING \(true\)/)
})

test('round 2 composite FKs cover quotes, catalog, agenda and inventory', () => {
  assert.match(round2, /quotes_customer_company_fkey/)
  assert.match(round2, /quotes_package_company_fkey/)
  assert.match(round2, /events_customer_company_fkey/)
  assert.match(round2, /agenda_events_team_company_fkey/)
  assert.match(round2, /inventory_document_lines_catalog_company_fkey/)
  assert.match(round2, /package_items_catalog_company_fkey/)
  assert.match(round2, /trg_public_quote_intake_quote_same_company/)
  assert.match(round2, /Issue #52 blocked/)
  assert.match(structural, /quote_a_customer_b/)
  assert.match(structural, /STRUCTURAL_CROSS_TENANT/)
})

test('engine no longer hardcodes CDL identity', () => {
  assert.doesNotMatch(persona, /65fd576f-8d97-49ba-bf38-61bc1e94e94a/)
  assert.doesNotMatch(invoicePdf, /CDL BBQ AT HOME/)
  assert.doesNotMatch(invoicePdf, /Orlando, Florida/)
  assert.doesNotMatch(resolveTenant, /65fd576f-8d97-49ba-bf38-61bc1e94e94a/)
  assert.match(resolveTenant, /company_context_required/)
  assert.match(harness, /signInWithPassword/)
  assert.match(harness, /cannot SELECT/)
  assert.doesNotMatch(harness, /from\('.*'\)[\s\S]{0,80}service_role as proof/)
})
