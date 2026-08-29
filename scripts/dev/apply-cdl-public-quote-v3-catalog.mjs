/**
 * DEV-only: upsert CDL waiter + disposable kit, relabel package sausages,
 * and add LINGUICA_OPTION (pork/chicken) to packages that already include
 * Toscana Tradicional. Never touches PROD. Does not change existing prices
 * except the two authorized new commercial services.
 *
 *   node scripts/dev/apply-cdl-public-quote-v3-catalog.mjs
 *   node scripts/dev/apply-cdl-public-quote-v3-catalog.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const PORK_KEY = 'ITEM_LINGUICA_TOSCANA_TRADICIONAL'
const CHICKEN_KEY = 'ITEM_024'
const WAITER_KEY = 'CDL_WAITER_SERVICE'
const KIT_KEY = 'KIT_DESCARTAVEIS'
const SAUSAGE_GROUP_KEY = 'LINGUICA_OPTION'

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: existingError } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, item_name, label_pt, label_en, label_es, price, pricing_type, charge_type, customer_visible, can_be_additional, inventory_enabled, item_type',
  )
  .eq('company_id', COMPANY_ID)
  .in('item_key', [PORK_KEY, CHICKEN_KEY, WAITER_KEY, KIT_KEY, 'ITEM_084'])

if (existingError) {
  console.error(existingError.message)
  process.exit(1)
}

const byKey = new Map((existing ?? []).map((row) => [row.item_key, row]))
const pork = byKey.get(PORK_KEY)
const chicken = byKey.get(CHICKEN_KEY)
const grill = byKey.get('ITEM_084')

if (!pork || !chicken) {
  console.error('Required sausage items missing — refusing to duplicate pork/chicken')
  process.exit(1)
}
if (!grill || Number(grill.price) !== 100) {
  console.error('ITEM_084 grill rental missing or price changed — abort')
  process.exit(1)
}

const waiterPayload = {
  company_id: COMPANY_ID,
  item_key: WAITER_KEY,
  item_name: 'GARÇOM',
  label_pt: 'GARÇOM',
  label_en: 'WAITER',
  label_es: 'MESERO',
  category_key: 'SERVICOS',
  category_pt: 'Serviços',
  category_en: 'Services',
  category_es: 'Servicios',
  item_type: 'PRODUCT',
  price: 250,
  sale_price: 250,
  pricing_type: 'PER_UNIT',
  charge_type: 'UNIT',
  currency_code: 'USD',
  unit: 'UN',
  unit_label: 'UN',
  quantity: 1,
  quantity_2: null,
  uom_2: null,
  active: true,
  customer_visible: true,
  can_be_additional: true,
  can_be_package_item: false,
  can_be_side_item: false,
  can_be_option_choice: false,
  inventory_enabled: false,
  operational_item: false,
  display_order: 900,
}

const kitPayload = {
  company_id: COMPANY_ID,
  item_key: KIT_KEY,
  item_name: 'KIT DE DESCARTÁVEIS',
  label_pt: 'KIT DE DESCARTÁVEIS',
  label_en: 'DISPOSABLE KIT',
  label_es: 'KIT DE DESECHABLES',
  category_key: 'SERVICOS',
  category_pt: 'Serviços',
  category_en: 'Services',
  category_es: 'Servicios',
  item_type: 'PRODUCT',
  price: 3,
  sale_price: 3,
  pricing_type: 'PER_PERSON',
  charge_type: 'PERSON',
  currency_code: 'USD',
  unit: 'UN',
  unit_label: 'UN',
  quantity: 1,
  quantity_2: null,
  uom_2: null,
  active: true,
  customer_visible: true,
  can_be_additional: true,
  can_be_package_item: false,
  can_be_side_item: false,
  can_be_option_choice: false,
  inventory_enabled: false,
  operational_item: false,
  display_order: 901,
}

const sausageLabelPatch = {
  [PORK_KEY]: {
    label_pt: 'TRADICIONAL PORCO',
    label_en: 'TRADITIONAL PORK SAUSAGE',
    label_es: 'SALCHICHA TRADICIONAL DE CERDO',
  },
  [CHICKEN_KEY]: {
    label_pt: 'TRADICIONAL FRANGO',
    label_en: 'TRADITIONAL CHICKEN SAUSAGE',
    label_es: 'SALCHICHA TRADICIONAL DE POLLO',
  },
}

const { data: sausagePackageItems, error: sausageItemsError } = await sb
  .from('package_items')
  .select('id, package_id, item_key, additional_item_id, is_choice_placeholder')
  .eq('company_id', COMPANY_ID)
  .eq('item_key', PORK_KEY)
  .eq('active', true)

if (sausageItemsError) {
  console.error(sausageItemsError.message)
  process.exit(1)
}

const packageIds = [
  ...new Set((sausagePackageItems ?? []).map((row) => row.package_id).filter(Boolean)),
]

const { data: existingGroups, error: groupsError } = await sb
  .from('package_option_groups')
  .select('id, package_id, group_key, option_group_key')
  .eq('company_id', COMPANY_ID)
  .in('package_id', packageIds.length > 0 ? packageIds : ['00000000-0000-4000-8000-000000000000'])
  .or(`group_key.eq.${SAUSAGE_GROUP_KEY},option_group_key.eq.${SAUSAGE_GROUP_KEY}`)

if (groupsError) {
  console.error(groupsError.message)
  process.exit(1)
}

const groupsByPackage = new Map(
  (existingGroups ?? []).map((row) => [row.package_id, row]),
)

console.log(
  JSON.stringify(
    {
      apply: APPLY,
      waiter: byKey.get(WAITER_KEY)?.id ?? 'CREATE',
      kit: byKey.get(KIT_KEY)?.id ?? 'CREATE',
      pork: pork.id,
      chicken: chicken.id,
      sausagePackages: packageIds.length,
      sausageGroupsExisting: existingGroups?.length ?? 0,
    },
    null,
    2,
  ),
)

if (!APPLY) {
  console.log('Dry run. Re-run with --apply to write DEV catalog.')
  process.exit(0)
}

async function upsertCatalogItem(payload, current) {
  if (current) {
    const { error } = await sb
      .from('catalog_items')
      .update({
        ...payload,
        price: current.item_key === WAITER_KEY || current.item_key === KIT_KEY
          ? payload.price
          : current.price,
      })
      .eq('id', current.id)
      .eq('company_id', COMPANY_ID)
    if (error) throw new Error(error.message)
    return current.id
  }
  const { data, error } = await sb
    .from('catalog_items')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

const waiterId = await upsertCatalogItem(waiterPayload, byKey.get(WAITER_KEY))
const kitId = await upsertCatalogItem(kitPayload, byKey.get(KIT_KEY))

for (const [itemKey, labels] of Object.entries(sausageLabelPatch)) {
  const row = byKey.get(itemKey)
  if (!row) continue
  const { error } = await sb
    .from('catalog_items')
    .update(labels)
    .eq('id', row.id)
    .eq('company_id', COMPANY_ID)
  if (error) throw new Error(error.message)
}

if (sausagePackageItems?.length) {
  const { error } = await sb
    .from('package_items')
    .update({ is_choice_placeholder: true })
    .in(
      'id',
      sausagePackageItems.map((row) => row.id),
    )
    .eq('company_id', COMPANY_ID)
  if (error) throw new Error(error.message)
}

for (const packageId of packageIds) {
  let group = groupsByPackage.get(packageId)
  if (!group) {
    const { data, error } = await sb
      .from('package_option_groups')
      .insert({
        company_id: COMPANY_ID,
        package_id: packageId,
        group_key: SAUSAGE_GROUP_KEY,
        option_group_key: SAUSAGE_GROUP_KEY,
        label_pt: 'Escolha da linguiça',
        label_en: 'Sausage choice',
        label_es: 'Elección de salchicha',
        required: true,
        is_required: true,
        min_choices: 1,
        max_choices: 1,
        display_order: 0,
        active: true,
        is_active: true,
        blocks_additional_items: true,
      })
      .select('id, package_id')
      .single()
    if (error) throw new Error(error.message)
    group = data
  }

  const { data: groupItems, error: groupItemsError } = await sb
    .from('package_option_group_items')
    .select('id, additional_item_id, option_item_key')
    .eq('company_id', COMPANY_ID)
    .eq('option_group_id', group.id)
  if (groupItemsError) throw new Error(groupItemsError.message)

  const wanted = [
    {
      additional_item_id: pork.id,
      option_item_key: 'tradicional_porco',
      label_pt: 'TRADICIONAL PORCO',
      label_en: 'TRADITIONAL PORK SAUSAGE',
      label_es: 'SALCHICHA TRADICIONAL DE CERDO',
      display_order: 1,
    },
    {
      additional_item_id: chicken.id,
      option_item_key: 'tradicional_frango',
      label_pt: 'TRADICIONAL FRANGO',
      label_en: 'TRADITIONAL CHICKEN SAUSAGE',
      label_es: 'SALCHICHA TRADICIONAL DE POLLO',
      display_order: 2,
    },
  ]

  for (const item of wanted) {
    const current = (groupItems ?? []).find(
      (row) =>
        row.additional_item_id === item.additional_item_id ||
        row.option_item_key === item.option_item_key,
    )
    if (current) {
      const { error } = await sb
        .from('package_option_group_items')
        .update({
          ...item,
          active: true,
          price_delta: 0,
        })
        .eq('id', current.id)
      if (error) throw new Error(error.message)
      continue
    }
    const { error } = await sb.from('package_option_group_items').insert({
      company_id: COMPANY_ID,
      option_group_id: group.id,
      ...item,
      active: true,
      price_delta: 0,
    })
    if (error) throw new Error(error.message)
  }
}

console.log(
  JSON.stringify(
    {
      applied: true,
      waiterId,
      kitId,
      sausagePackages: packageIds.length,
    },
    null,
    2,
  ),
)
