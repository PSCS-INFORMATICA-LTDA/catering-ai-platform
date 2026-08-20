/**
 * Seed DEV — package/additional BOM TEST-DEV + regras demonstrativas.
 * Uso: node scripts/dev/seed-materials-bom-demo.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

const PKG_ID = 'c2600000-0000-4000-8000-0000000000b1'
const ADD_ID = 'c2600000-0000-4000-8000-0000000000b2'
const RULES = {
  carne: 'c2700000-0000-4000-8000-0000000000b1',
  gelo: 'c2700000-0000-4000-8000-0000000000b2',
  cooler: 'c2700000-0000-4000-8000-0000000000b3',
  guardanapos: 'c2700000-0000-4000-8000-0000000000b4',
  geloExtra: 'c2700000-0000-4000-8000-0000000000b5',
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') }
}

const { url, key } = loadEnv()
if (url.includes(PROD) || !url.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== SEED MATERIALS BOM DEMO ===')
console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
console.log('package=TEST-DEV-PACKAGE-BOM')
console.log('additional=TEST-DEV-ADDITIONAL-BOM')

if (!apply) {
  console.log('Dry-run OK. Use --apply')
  process.exit(0)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const { error: pkgErr } = await sb.from('packages').upsert(
  {
    id: PKG_ID,
    company_id: COMPANY,
    package_key: 'TEST-DEV-PACKAGE-BOM',
    package_name: 'TEST-DEV Package BOM',
    label_pt: 'TEST-DEV Pacote BOM',
    price_per_person: 45,
    currency_code: 'USD',
    active: true,
    display_order: 990,
  },
  { onConflict: 'id' },
)
if (pkgErr) throw new Error(`package: ${pkgErr.message}`)

const { error: addErr } = await sb.from('catalog_items').upsert(
  {
    id: ADD_ID,
    company_id: COMPANY,
    item_key: 'TEST-DEV-ADDITIONAL-BOM',
    item_name: 'TEST-DEV Additional BOM',
    label_pt: 'TEST-DEV Adicional BOM',
    item_type: 'PRODUCT',
    can_be_additional: true,
    customer_visible: true,
    active: true,
    charge_type: 'UNIT',
    pricing_type: 'FIXED',
    sale_price: 25,
    price: 25,
    unit: 'unit',
    unit_label: 'unit',
  },
  { onConflict: 'id' },
)
if (addErr) throw new Error(`additional: ${addErr.message}`)

await sb
  .from('operational_material_rules')
  .delete()
  .eq('company_id', COMPANY)
  .in('id', Object.values(RULES))

const rules = [
  {
    id: RULES.carne,
    source_type: 'package',
    source_id: PKG_ID,
    material_description_snapshot: 'Carne',
    material_type: 'consumable',
    unit: 'lb',
    calculation_type: 'per_guest',
    quantity_per_guest: 1,
    guest_basis: 'billable_guests',
    rounding_rule: 'none',
    sort_order: 1,
  },
  {
    id: RULES.gelo,
    source_type: 'package',
    source_id: PKG_ID,
    material_description_snapshot: 'Gelo',
    material_type: 'consumable',
    unit: 'bag',
    calculation_type: 'tier',
    guest_basis: 'billable_guests',
    tier_json: [
      { min_guests: 1, max_guests: 30, quantity: 1 },
      { min_guests: 31, max_guests: 60, quantity: 2 },
      { min_guests: 61, max_guests: 100, quantity: 3 },
    ],
    rounding_rule: 'none',
    sort_order: 2,
  },
  {
    id: RULES.cooler,
    source_type: 'package',
    source_id: PKG_ID,
    material_description_snapshot: 'Cooler',
    material_type: 'returnable',
    unit: 'unit',
    calculation_type: 'fixed',
    fixed_quantity: 2,
    rounding_rule: 'none',
    sort_order: 3,
  },
  {
    id: RULES.guardanapos,
    source_type: 'package',
    source_id: PKG_ID,
    material_description_snapshot: 'Guardanapos',
    material_type: 'disposable',
    unit: 'box',
    calculation_type: 'per_guest',
    quantity_per_guest: 0.25,
    guest_basis: 'billable_guests',
    rounding_rule: 'ceil',
    sort_order: 4,
  },
  {
    id: RULES.geloExtra,
    source_type: 'additional',
    source_id: ADD_ID,
    material_description_snapshot: 'Gelo',
    material_type: 'consumable',
    unit: 'bag',
    calculation_type: 'fixed',
    fixed_quantity: 2,
    rounding_rule: 'none',
    sort_order: 1,
    notes: 'extra do adicional TEST-DEV',
  },
]

for (const r of rules) {
  const { error } = await sb.from('operational_material_rules').insert({
    ...r,
    company_id: COMPANY,
    enabled: true,
  })
  if (error) throw new Error(`rule ${r.material_description_snapshot}: ${error.message}`)
}

console.log(`OK package=${PKG_ID}`)
console.log(`OK additional=${ADD_ID}`)
console.log(`OK rules=${rules.length}`)
process.exit(0)
