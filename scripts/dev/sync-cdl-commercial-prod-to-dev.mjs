/**
 * Importa regras comerciais + payment/staff/templates + catálogo CDL
 * de PROD (read-only) → DEV (write) para testes confiáveis de cotação.
 *
 * Uso:
 *   node scripts/dev/sync-cdl-commercial-prod-to-dev.mjs           # dry-run
 *   node scripts/dev/sync-cdl-commercial-prod-to-dev.mjs --apply
 *
 * Não copia clientes, cotações, eventos nem PII.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const apply = process.argv.includes('--apply')

function load(name) {
  const env = readFileSync(join(ROOT, name), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function refOf(url) {
  return (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
}

async function selectAll(client, table, filter) {
  let q = client.from(table).select('*')
  q = filter(q)
  const { data, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
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

async function trySelect(client, table, filter) {
  try {
    return await selectAll(client, table, filter)
  } catch (e) {
    console.warn(`  skip ${table}: ${e.message}`)
    return null
  }
}

async function main() {
  console.log(
    `\n=== sync-cdl-commercial-prod-to-dev (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`,
  )
  const prodEnv = load('.env.local.PROD-BACKUP')
  const devEnv = load('.env.local')
  if (refOf(devEnv.url) !== DEV_REF || refOf(prodEnv.url) !== PROD_REF) {
    console.error('BLOQUEADO — refs inválidos')
    process.exit(2)
  }

  const prod = createClient(prodEnv.url, prodEnv.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const dev = createClient(devEnv.url, devEnv.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const byCompany = (q) => q.eq('company_id', CDL)

  console.log('Lendo PROD…')
  const commercialRules = await selectAll(prod, 'commercial_rules', byCompany)
  const paymentRules = await selectAll(prod, 'payment_rules', byCompany)
  const staffRules = await trySelect(prod, 'staff_rules', byCompany)
  const quoteTemplates = await trySelect(prod, 'quote_text_templates', byCompany)
  const packages = await selectAll(prod, 'packages', byCompany)
  const categories = await selectAll(prod, 'package_categories', byCompany)
  const catalogItems = await selectAll(prod, 'catalog_items', byCompany)
  const catalogPrices = await trySelect(prod, 'catalog_item_prices', byCompany)
  const packageIds = packages.map((p) => p.id)
  const packageItems = packageIds.length
    ? await selectAll(prod, 'package_items', (q) => q.in('package_id', packageIds))
    : []
  const packageSides = packageIds.length
    ? await selectAll(prod, 'package_side_items', (q) =>
        q.in('package_id', packageIds),
      )
    : []
  const optionGroups = packageIds.length
    ? await selectAll(prod, 'package_option_groups', (q) =>
        q.in('package_id', packageIds),
      )
    : []
  const groupIds = optionGroups.map((g) => g.id)
  const optionGroupItems = groupIds.length
    ? (await trySelect(prod, 'package_option_group_items', (q) =>
        q.in('option_group_id', groupIds),
      )) || []
    : []
  const optionValues = groupIds.length
    ? (await trySelect(prod, 'package_option_values', (q) =>
        q.in('option_group_id', groupIds),
      )) || []
    : []

  const { data: prodCompany } = await prod
    .from('companies')
    .select('*')
    .eq('id', CDL)
    .maybeSingle()
  const { data: prodBranch } = await prod
    .from('branches')
    .select('*')
    .eq('company_id', CDL)
    .maybeSingle()

  console.log('\nInventário PROD (CDL):')
  console.log(`  commercial_rules:           ${commercialRules.length}`)
  console.log(`  payment_rules:              ${paymentRules.length}`)
  console.log(`  staff_rules:                ${staffRules?.length ?? 'n/a'}`)
  console.log(`  quote_text_templates:       ${quoteTemplates?.length ?? 'n/a'}`)
  console.log(`  packages:                   ${packages.length}`)
  console.log(`  package_categories:         ${categories.length}`)
  console.log(`  catalog_items:              ${catalogItems.length}`)
  console.log(`  catalog_item_prices:        ${catalogPrices?.length ?? 0}`)
  console.log(`  package_items:              ${packageItems.length}`)
  console.log(`  package_side_items:         ${packageSides.length}`)
  console.log(`  package_option_groups:      ${optionGroups.length}`)
  console.log(`  package_option_group_items: ${optionGroupItems.length}`)
  console.log(`  package_option_values:      ${optionValues.length}`)

  console.log('\nRegras comerciais:')
  for (const r of commercialRules) {
    const v = r.rule_value?.value ?? r.rule_value
    console.log(`  - ${r.rule_key} = ${JSON.stringify(v)}`)
  }
  console.log('\nPayment rules:')
  for (const r of paymentRules) {
    console.log(`  - ${r.rule_key} = ${r.rule_value}`)
  }

  if (!apply) {
    console.log('\nDry-run OK. Rode com --apply para gravar no DEV.')
    return
  }

  console.log('\nGravando no DEV…')

  // Franchise (se existir em PROD) — evita FK na companies
  if (prodCompany?.franchise_group_id) {
    const { data: franchise } = await prod
      .from('franchise_groups')
      .select('*')
      .eq('id', prodCompany.franchise_group_id)
      .maybeSingle()
    if (franchise) {
      const { error } = await dev.from('franchise_groups').upsert(franchise, {
        onConflict: 'id',
      })
      if (error) console.warn(`  franchise_groups: ${error.message}`)
      else console.log('  ✓ franchise_groups (1)')
    }
  }

  // Empresa: atualiza campos comerciais sem sobrescrever colunas DEV-only
  if (prodCompany) {
    const companyPatch = {
      company_name: prodCompany.company_name,
      trade_name: `${prodCompany.trade_name || prodCompany.company_name || 'CDL'} DEV`,
      currency_code: prodCompany.currency_code,
      default_language: prodCompany.default_language,
      timezone: prodCompany.timezone,
      active: prodCompany.active,
      franchise_group_id: prodCompany.franchise_group_id,
      legal_name: prodCompany.legal_name ?? null,
      company_code: prodCompany.company_code ?? null,
      slug: prodCompany.slug ?? null,
    }
    const { error } = await dev
      .from('companies')
      .update(companyPatch)
      .eq('id', CDL)
    if (error) throw new Error(`companies: ${error.message}`)
    console.log('  ✓ companies (update) — trade_name com sufixo DEV')
  }

  if (prodBranch) {
    const branchPatch = {
      id: prodBranch.id,
      company_id: prodBranch.company_id,
      name: prodBranch.name,
      code: prodBranch.code,
      active: prodBranch.active,
      timezone: prodBranch.timezone,
      address_line1: prodBranch.address_line1,
      address_line2: prodBranch.address_line2,
      city: prodBranch.city,
      state: prodBranch.state,
      postal_code: prodBranch.postal_code,
      country: prodBranch.country,
    }
    const { error } = await dev.from('branches').upsert(branchPatch, {
      onConflict: 'id',
    })
    if (error) console.warn(`  branches: ${error.message}`)
    else console.log('  ✓ branches (1)')
  }

  const results = []
  results.push(await upsertDev(dev, 'commercial_rules', commercialRules))
  results.push(await upsertDev(dev, 'payment_rules', paymentRules))
  if (staffRules) results.push(await upsertDev(dev, 'staff_rules', staffRules))
  if (quoteTemplates) {
    results.push(await upsertDev(dev, 'quote_text_templates', quoteTemplates))
  }
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
  if (catalogPrices?.length) {
    results.push(await upsertDev(dev, 'catalog_item_prices', catalogPrices))
  }

  for (const r of results) console.log(`  ✓ ${r.table}: ${r.count}`)

  // Remove seeds DEV que poluem as regras comerciais (não existem em PROD)
  const { error: seedDelErr } = await dev
    .from('commercial_rules')
    .delete()
    .eq('company_id', CDL)
    .like('rule_key', 'dev_seed_%')
  if (seedDelErr) console.warn(`  seed cleanup: ${seedDelErr.message}`)
  else console.log('  ✓ removed commercial_rules dev_seed_*')

  // Pacotes de fixture fora da lista comercial
  const { error: deactErr } = await dev
    .from('packages')
    .update({ active: false })
    .eq('company_id', CDL)
    .or('package_key.like.TEST-DEV-%,package_key.like.DEV_BBQ_%')
  if (deactErr) console.warn(`  deactivate fixtures: ${deactErr.message}`)
  else console.log('  ✓ deactivated TEST-DEV / DEV_BBQ packages')

  // Imagens → storage DEV
  console.log('\nCopiando imagens PROD → storage DEV…')
  const img = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts/dev/sync-cdl-package-images-prod-to-dev.mjs'), '--apply'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  process.stdout.write(img.stdout || '')
  process.stderr.write(img.stderr || '')
  if (img.status !== 0) {
    throw new Error('Falha ao sincronizar imagens')
  }

  const { count: payCount } = await dev
    .from('payment_rules')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', CDL)
    .eq('active', true)
  const { count: comCount } = await dev
    .from('commercial_rules')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', CDL)
    .eq('active', true)
  const { count: pkgCount } = await dev
    .from('packages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', CDL)
    .eq('active', true)

  console.log('\nDEV agora:')
  console.log(`  commercial_rules active: ${comCount}`)
  console.log(`  payment_rules active:    ${payCount}`)
  console.log(`  packages active:         ${pkgCount}`)
  console.log('\nSync comercial concluído. PROD não foi alterado.')
}

main().catch((e) => {
  console.error('\nFALHA:', e.message || e)
  process.exit(1)
})
