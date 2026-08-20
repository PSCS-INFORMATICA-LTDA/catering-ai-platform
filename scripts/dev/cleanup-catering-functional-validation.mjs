/**
 * Cleanup OPCIONAL — remove SOMENTE registros do fixture v1.
 *
 * NÃO executar automaticamente.
 * Uso futuro (confirmação explícita obrigatória):
 *   node scripts/dev/cleanup-catering-functional-validation.mjs --confirm-dev-cleanup
 *
 * Regras:
 * - Revalida Project Ref DEV
 * - Não usa DELETE geral por company_id
 * - Remove apenas IDs do fixture, na ordem inversa das FKs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const fx = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures', 'catering-functional-validation-v1.json'),
    'utf8',
  ),
)

if (!process.argv.includes('--confirm-dev-cleanup')) {
  console.error(
    'Recusado. Passe --confirm-dev-cleanup para remover somente IDs do fixture v1 no DEV.',
  )
  process.exit(1)
}

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref === PROD_REF) {
  console.error('BLOQUEADO — PROD')
  process.exit(2)
}
if (ref !== DEV_REF) {
  console.error('BLOQUEADO — ref ' + ref)
  process.exit(2)
}

const client = createClient(url, get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})
const id = fx.ids

async function del(table, ids) {
  for (const rowId of ids) {
    const { error } = await client.from(table).delete().eq('id', rowId)
    if (error) console.log(`WARN ${table} ${rowId}: ${error.message}`)
    else console.log(`DEL ${table} ${rowId}`)
  }
}

// ordem inversa FKs
await client
  .from('quote_additional_items')
  .delete()
  .eq('quote_id', id.quoteMain)
console.log('DEL quote_additional_items by quote_main')
await del('quotes', [id.quoteMain])
await del('events', [id.eventMain])
await del('customers', [id.customerMain, id.customerIso])
// package_items by known ids prefix e200...
const piIds = [
  'e2000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000002',
  'e2000000-0000-4000-8000-000000000003',
  'e2000000-0000-4000-8000-000000000004',
  'e2000000-0000-4000-8000-000000000005',
  'e2000000-0000-4000-8000-000000000006',
  'e2000000-0000-4000-8000-000000000007',
  'e2000000-0000-4000-8000-000000000008',
  'e2000000-0000-4000-8000-000000000009',
]
await del('package_items', piIds)
await del('catalog_items', [
  id.itemBeef,
  id.itemChicken,
  id.itemRice,
  id.itemSalad,
  id.itemBread,
  id.itemSetup,
  id.addDessert,
  id.addTable,
  id.addTravel,
  id.addStaff,
  id.itemIso,
])
await del('packages', [id.pkgEssential, id.pkgPremium, id.pkgFixed, id.pkgIso])
await del('package_categories', [
  id.catMeats,
  id.catSides,
  id.catDrinks,
  id.catServices,
  id.catIso,
])
await del('branches', [id.branchMain])
// NÃO apagar companyMain (CDL app default) — apenas iso
await del('companies', [id.companyIso])
console.log(
  'NOTE: company_main (CDL default) preservada; limpar catalog legado anterior manualmente se necessario',
)
console.log('CLEANUP_DONE')
