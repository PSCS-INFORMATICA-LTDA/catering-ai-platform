/**
 * Copia pacotes/catálogo CDL de PROD (somente leitura) → DEV (escrita).
 *
 * Uso:
 *   node scripts/dev/sync-cdl-packages-prod-to-dev.mjs           # dry-run
 *   node scripts/dev/sync-cdl-packages-prod-to-dev.mjs --apply   # grava no DEV
 *
 * Fontes:
 *   PROD → .env.local.PROD-BACKUP  (SELECT only)
 *   DEV  → .env.local              (upsert)
 *
 * Não copia clientes, cotações nem PII.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

const apply = process.argv.includes('--apply')

function loadEnvFile(name) {
  const env = readFileSync(join(ROOT, name), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function projectRef(url) {
  return (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
}

function assertRefs(devUrl, prodUrl) {
  const dev = projectRef(devUrl)
  const prod = projectRef(prodUrl)
  if (dev !== DEV_REF) {
    console.error(`BLOQUEADO — DEV ref inesperado: ${dev}`)
    process.exit(2)
  }
  if (prod !== PROD_REF) {
    console.error(`BLOQUEADO — PROD backup ref inesperado: ${prod}`)
    process.exit(2)
  }
  if (dev === prod) {
    console.error('BLOQUEADO — DEV e PROD apontam para o mesmo projeto')
    process.exit(2)
  }
  return { dev, prod }
}

async function selectAll(client, table, columns, filter) {
  let q = client.from(table).select(columns)
  q = filter(q)
  const { data, error } = await q
  if (error) {
    throw new Error(`${table}: ${error.message}`)
  }
  return data || []
}

async function upsertDev(client, table, rows, onConflict = 'id') {
  if (!rows.length) return { table, count: 0 }
  const chunk = 200
  let written = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await client.from(table).upsert(slice, { onConflict })
    if (error) throw new Error(`DEV upsert ${table}: ${error.message}`)
    written += slice.length
  }
  return { table, count: written }
}

function summarizePackages(rows) {
  return rows.map((p) => ({
    key: p.package_key,
    name: p.label_pt || p.package_name,
    price: p.price_per_person,
    active: p.active,
  }))
}

async function main() {
  const mode = apply ? 'APPLY → DEV' : 'DRY-RUN'
  console.log(`\n=== sync-cdl-packages-prod-to-dev (${mode}) ===\n`)

  const prodEnv = loadEnvFile('.env.local.PROD-BACKUP')
  const devEnv = loadEnvFile('.env.local')
  if (!prodEnv.url || !prodEnv.service || !devEnv.url || !devEnv.service) {
    console.error('Credenciais ausentes em .env.local ou .env.local.PROD-BACKUP')
    process.exit(2)
  }
  const refs = assertRefs(devEnv.url, prodEnv.url)
  console.log(`PROD (read-only): ${refs.prod}`)
  console.log(`DEV  (write):     ${refs.dev}`)
  console.log(`company_id:       ${CDL_COMPANY_ID}`)

  const prod = createClient(prodEnv.url, prodEnv.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const dev = createClient(devEnv.url, devEnv.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const byCompany = (q) => q.eq('company_id', CDL_COMPANY_ID)

  console.log('\nLendo PROD…')
  const packages = await selectAll(prod, 'packages', '*', byCompany)
  const categories = await selectAll(prod, 'package_categories', '*', byCompany)
  const catalogItems = await selectAll(prod, 'catalog_items', '*', byCompany)
  const commercialRules = await selectAll(prod, 'commercial_rules', '*', byCompany)

  let catalogPrices = []
  try {
    catalogPrices = await selectAll(prod, 'catalog_item_prices', '*', byCompany)
  } catch (e) {
    console.warn(`catalog_item_prices: ${e.message} (ignorado)`)
  }

  const packageIds = packages.map((p) => p.id)
  let packageItems = []
  let packageSides = []
  let optionGroups = []
  let optionGroupItems = []
  let optionValues = []

  if (packageIds.length) {
    packageItems = await selectAll(prod, 'package_items', '*', (q) =>
      q.in('package_id', packageIds),
    )
    packageSides = await selectAll(prod, 'package_side_items', '*', (q) =>
      q.in('package_id', packageIds),
    )
    optionGroups = await selectAll(prod, 'package_option_groups', '*', (q) =>
      q.in('package_id', packageIds),
    )
    const groupIds = optionGroups.map((g) => g.id)
    if (groupIds.length) {
      try {
        optionGroupItems = await selectAll(
          prod,
          'package_option_group_items',
          '*',
          (q) => q.in('option_group_id', groupIds),
        )
      } catch (e) {
        console.warn(`package_option_group_items: ${e.message}`)
      }
      try {
        optionValues = await selectAll(prod, 'package_option_values', '*', (q) =>
          q.in('option_group_id', groupIds),
        )
      } catch (e) {
        console.warn(`package_option_values: ${e.message}`)
      }
    }
  }

  console.log('\nInventário PROD (CDL):')
  console.log(`  packages:                 ${packages.length}`)
  console.log(`  package_categories:       ${categories.length}`)
  console.log(`  catalog_items:            ${catalogItems.length}`)
  console.log(`  catalog_item_prices:      ${catalogPrices.length}`)
  console.log(`  package_items:            ${packageItems.length}`)
  console.log(`  package_side_items:       ${packageSides.length}`)
  console.log(`  package_option_groups:    ${optionGroups.length}`)
  console.log(`  package_option_group_items: ${optionGroupItems.length}`)
  console.log(`  package_option_values:    ${optionValues.length}`)
  console.log(`  commercial_rules:         ${commercialRules.length}`)
  console.log('\nPacotes:')
  for (const row of summarizePackages(packages)) {
    console.log(
      `  - ${row.key || '(sem key)'} | ${row.name} | $${row.price} | active=${row.active}`,
    )
  }

  const { data: devExisting, error: devListErr } = await dev
    .from('packages')
    .select('id, package_key, label_pt, package_name, price_per_person, active')
    .eq('company_id', CDL_COMPANY_ID)
  if (devListErr) throw new Error(`DEV packages list: ${devListErr.message}`)
  console.log(`\nPacotes já no DEV: ${(devExisting || []).length}`)

  if (!apply) {
    console.log('\nDry-run OK. Rode com --apply para gravar no DEV.')
    console.log('Imagens: URLs de PROD são preservadas (bucket público).')
    return
  }

  console.log('\nGravando no DEV (upsert por id)…')
  const results = []
  results.push(await upsertDev(dev, 'package_categories', categories))
  results.push(await upsertDev(dev, 'catalog_items', catalogItems))
  results.push(await upsertDev(dev, 'packages', packages))
  results.push(await upsertDev(dev, 'package_items', packageItems))
  results.push(await upsertDev(dev, 'package_side_items', packageSides))
  results.push(await upsertDev(dev, 'package_option_groups', optionGroups))
  results.push(
    await upsertDev(dev, 'package_option_group_items', optionGroupItems),
  )
  results.push(await upsertDev(dev, 'package_option_values', optionValues))
  results.push(await upsertDev(dev, 'commercial_rules', commercialRules))
  if (catalogPrices.length) {
    results.push(await upsertDev(dev, 'catalog_item_prices', catalogPrices))
  }

  for (const r of results) {
    console.log(`  ✓ ${r.table}: ${r.count}`)
  }

  const { count, error: verifyErr } = await dev
    .from('packages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', CDL_COMPANY_ID)
    .eq('active', true)
  if (verifyErr) throw new Error(verifyErr.message)
  console.log(`\nDEV ativo agora: ${count} pacote(s) CDL active=true`)
  console.log('Sync concluído. PROD não foi alterado.')
}

main().catch((err) => {
  console.error('\nFALHA:', err.message || err)
  process.exit(1)
})
