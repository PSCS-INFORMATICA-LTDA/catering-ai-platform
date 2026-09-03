/**
 * DEV-only: create/reconcile BBQ Luxury from the CDL 2026 text source.
 *
 * Uses BBQPRI / BBQPRI+ as the structural template.
 * Never writes PROD. Never changes other package prices.
 *
 *   node scripts/dev/apply-cdl-bbq-luxury.mjs
 *   node scripts/dev/apply-cdl-bbq-luxury.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatCatalogDisplayLabel } from '../../Lib/publicQuote/catalogDisplayName.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const NOW = new Date().toISOString()
const PROTEIN_CATEGORY_ID = 'ddcfe5f1-d6e8-44b3-964f-7d56f490488b'

const FROZEN_PRICES = {
  BBQTRAD: 45,
  BBQSEL: 55,
  BBQCHO: 65,
  BBQPRI: 75,
  'BBQTRAD+': 58,
  'BBQSEL+': 68,
  'BBQCHO+': 78,
  'BBQPRI+': 88,
  BBQPERS: 0,
  'BBQPERS+': 0,
}

const CATALOG = {
  PICANHA_ANGUS: 'ITEM_001',
  PICANHA_WAGYU: 'ITEM_009',
  FRALDINHA_ANGUS: 'ITEM_004',
  CARRE_CORDEIRO: 'ITEM_047',
  LINGUICA: 'ITEM_LINGUICA_TOSCANA_TRADICIONAL',
  FRANGO: 'ITEM_FRANGO_SOBRECOXA',
  PAO_DE_ALHO: 'ITEM_058',
  QUEIJO: 'ITEM_065',
  MILHO: 'ITEM_037',
  LAGOSTA: 'ITEM_051',
  VIEIRA: 'ITEM_053',
  SALMAO: 'ITEM_048',
  CAMARAO: 'ITEM_050',
  COSTELA_BOI: 'ITEM_003',
  COSTELA_PORCO: 'ITEM_014',
  ARROZ: 'ITEM_075',
  FEIJAO: 'ITEM_FEIJAO_PRETO',
  MAIONESE: 'ITEM_076',
  VINAGRETE: 'ITEM_082',
  CESAR: 'ITEM_077',
}

const COMMON_ACCOMPANIMENTS = [
  'Chimichurri',
  'Farofa',
  'Mel',
  'Goiabada',
  'Pimenta de bico',
  'Geleia de pimenta',
]

const LUXURY_ITEMS = [
  'Picanha Angus',
  'Picanha Wagyu',
  'Lagosta ou Vieira com bacon',
  'Salmão ou camarão',
  'Costela de porco ou boi',
  'Fraldinha Angus',
  'Carré de cordeiro',
  'Linguiça',
  'Frango sobrecoxa desossada',
  'Pão de alho',
  'Queijo',
  'Milho',
]

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
if (env.companyId !== COMPANY_ID) {
  console.error('COMPANY mismatch', env.companyId)
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function fail(message) {
  console.error(message)
  process.exit(2)
}

async function must(table, query) {
  const { data, error } = await query
  if (error) fail(`${table}: ${error.message}`)
  return data
}

function buildDescription(withSides) {
  const lines = [
    'Itens do pacote:',
    ...LUXURY_ITEMS.map((item) => `• ${item}`),
    '',
    'Todos os pacotes acompanham:',
    ...COMMON_ACCOMPANIMENTS.map((item) => `• ${item}`),
  ]
  if (withSides) {
    lines.push(
      '',
      'Guarnições inclusas (+$13/pessoa):',
      '• Arroz branco',
      '• Feijão preto',
      '• Maionese',
      '• Vinagrete ou salada César',
      '• Estrutura de mesa com rechauds e descartáveis: pratos, talheres e guardanapos',
    )
  }
  return lines.join('\n')
}

const ITEMS_DESCRIPTION =
  'Picanha Angus • Picanha Wagyu • Fraldinha Angus • Carré de cordeiro • Linguiça • Frango sobrecoxa desossada • Pão de alho • Queijo coalho • Milho • Lagosta ou Vieira com bacon • Salmão ou camarão • Costela de boi ou costela de porco • Chimichurri • Farofa • Mel • Goiabada • Pimenta de bico • Geleia de pimenta'

const HIGHLIGHTS =
  'Picanha Wagyu • Lagosta ou Vieira com bacon • Salmão ou camarão • Costela de boi ou costela de porco • Experiência luxury completa'

const GARNISH_DESCRIPTION =
  'Arroz branco • Feijão preto • Maionese • Vinagrete ou Salada César'

function packagePayload(withSides) {
  const description = buildDescription(withSides)
  return {
    company_id: COMPANY_ID,
    package_key: withSides ? 'BBQLUX+' : 'BBQLUX',
    package_name: withSides ? 'BBQ Luxury com guarnições' : 'BBQ Luxury',
    label_pt: withSides ? 'BBQ Luxury com guarnições' : 'BBQ Luxury',
    label_en: withSides ? 'BBQ Luxury with side dishes' : 'BBQ Luxury',
    label_es: withSides ? 'BBQ Luxury con guarniciones' : 'BBQ Luxury',
    price_per_person: withSides ? 163 : 150,
    currency_code: 'USD',
    description,
    description_pt: description,
    description_en: description,
    description_es: description,
    items_description_pt: ITEMS_DESCRIPTION,
    garnish_description_pt: withSides ? GARNISH_DESCRIPTION : 'Não inclusas',
    sides_description_pt: withSides ? GARNISH_DESCRIPTION : 'Não inclusas',
    package_highlights_pt: HIGHLIGHTS,
    package_highlights_en: HIGHLIGHTS,
    package_highlights_es: HIGHLIGHTS,
    highlight_pt: withSides
      ? 'Pacote luxury com Wagyu, lagosta ou vieira com bacon e guarnições.'
      : 'Pacote luxury com Wagyu, lagosta ou vieira com bacon.',
    display_order: withSides ? 11 : 5,
    card_theme_key: 'gold',
    image_status: 'missing',
    active: true,
    updated_at: NOW,
  }
}

async function upsertPackage(payload) {
  const existing = await must(
    'packages.select',
    sb
      .from('packages')
      .select('id,package_key')
      .eq('company_id', COMPANY_ID)
      .eq('package_key', payload.package_key)
      .maybeSingle(),
  )
  if (existing?.id) {
    const { error } = await sb.from('packages').update(payload).eq('id', existing.id)
    if (error) fail(`packages.update ${payload.package_key}: ${error.message}`)
    return existing.id
  }
  const { data, error } = await sb
    .from('packages')
    .insert(payload)
    .select('id')
    .single()
  if (error) fail(`packages.insert ${payload.package_key}: ${error.message}`)
  return data.id
}

async function upsertItem(packageId, spec, catalog) {
  const catalogItem = catalog[spec.catalogKey]
  if (!catalogItem) fail(`Missing catalog ${spec.catalogKey}`)
  const payload = {
    company_id: COMPANY_ID,
    package_id: packageId,
    category_id: PROTEIN_CATEGORY_ID,
    item_key: spec.itemKey,
    item_name: formatCatalogDisplayLabel(spec.label_pt, 'pt'),
    label_pt: formatCatalogDisplayLabel(spec.label_pt, 'pt'),
    label_en: formatCatalogDisplayLabel(spec.label_en, 'en'),
    label_es: formatCatalogDisplayLabel(spec.label_es, 'es'),
    additional_item_id: catalogItem.id,
    included: true,
    active: true,
    is_choice_placeholder: false,
    blocks_additional_item: true,
    display_order: spec.order,
    quantity: spec.quantity ?? 10,
    unit: spec.unit ?? 'LB',
    updated_at: NOW,
  }
  const existing = await must(
    'package_items.select',
    sb
      .from('package_items')
      .select('id')
      .eq('package_id', packageId)
      .eq('item_key', spec.itemKey)
      .maybeSingle(),
  )
  if (existing?.id) {
    const { error } = await sb.from('package_items').update(payload).eq('id', existing.id)
    if (error) fail(`package_items.update ${spec.itemKey}: ${error.message}`)
    return existing.id
  }
  const { data, error } = await sb
    .from('package_items')
    .insert(payload)
    .select('id')
    .single()
  if (error) fail(`package_items.insert ${spec.itemKey}: ${error.message}`)
  return data.id
}

async function upsertGroup(packageId, spec) {
  const payload = {
    company_id: COMPANY_ID,
    package_id: packageId,
    option_group_key: spec.key,
    group_key: spec.key,
    label_pt: spec.label_pt,
    label_en: spec.label_en,
    label_es: spec.label_es,
    required: true,
    is_required: true,
    min_choices: 1,
    max_choices: 1,
    blocks_additional_items: true,
    display_order: spec.order,
    active: true,
    is_active: true,
    updated_at: NOW,
  }
  const existing = await must(
    'package_option_groups.select',
    sb
      .from('package_option_groups')
      .select('id')
      .eq('package_id', packageId)
      .eq('option_group_key', spec.key)
      .maybeSingle(),
  )
  if (existing?.id) {
    const { error } = await sb
      .from('package_option_groups')
      .update(payload)
      .eq('id', existing.id)
    if (error) fail(`option_groups.update ${spec.key}: ${error.message}`)
    return existing.id
  }
  const { data, error } = await sb
    .from('package_option_groups')
    .insert(payload)
    .select('id')
    .single()
  if (error) fail(`option_groups.insert ${spec.key}: ${error.message}`)
  return data.id
}

async function upsertGroupItem(groupId, spec, catalog) {
  const catalogItem = catalog[spec.catalogKey]
  if (!catalogItem) fail(`Missing catalog ${spec.catalogKey}`)
  const payload = {
    company_id: COMPANY_ID,
    option_group_id: groupId,
    option_item_key: spec.key,
    label_pt: formatCatalogDisplayLabel(spec.label_pt, 'pt'),
    label_en: formatCatalogDisplayLabel(spec.label_en, 'en'),
    label_es: formatCatalogDisplayLabel(spec.label_es, 'es'),
    additional_item_id: catalogItem.id,
    display_order: spec.order,
    active: true,
    price_delta: 0,
    updated_at: NOW,
  }
  const existing = await must(
    'package_option_group_items.select',
    sb
      .from('package_option_group_items')
      .select('id')
      .eq('option_group_id', groupId)
      .eq('option_item_key', spec.key)
      .maybeSingle(),
  )
  if (existing?.id) {
    const { error } = await sb
      .from('package_option_group_items')
      .update(payload)
      .eq('id', existing.id)
    if (error) fail(`option_items.update ${spec.key}: ${error.message}`)
    return existing.id
  }
  const { data, error } = await sb
    .from('package_option_group_items')
    .insert(payload)
    .select('id')
    .single()
  if (error) fail(`option_items.insert ${spec.key}: ${error.message}`)
  return data.id
}

async function upsertSide(packageId, spec, catalog) {
  const catalogItem = catalog[spec.catalogKey]
  if (!catalogItem) fail(`Missing catalog ${spec.catalogKey}`)
  const payload = {
    company_id: COMPANY_ID,
    package_id: packageId,
    additional_item_id: catalogItem.id,
    item_key: catalogItem.item_key,
    item_name: formatCatalogDisplayLabel(spec.label_pt, 'pt'),
    label_pt: formatCatalogDisplayLabel(spec.label_pt, 'pt'),
    label_en: formatCatalogDisplayLabel(spec.label_en, 'en'),
    label_es: formatCatalogDisplayLabel(spec.label_es, 'es'),
    quantity: 1,
    included: true,
    blocks_additional_item: true,
    display_order: spec.order,
    active: true,
    updated_at: NOW,
  }
  const existing = await must(
    'package_side_items.select',
    sb
      .from('package_side_items')
      .select('id')
      .eq('package_id', packageId)
      .eq('item_key', catalogItem.item_key)
      .maybeSingle(),
  )
  if (existing?.id) {
    const { error } = await sb
      .from('package_side_items')
      .update(payload)
      .eq('id', existing.id)
    if (error) fail(`sides.update ${spec.catalogKey}: ${error.message}`)
    return existing.id
  }
  const { data, error } = await sb
    .from('package_side_items')
    .insert(payload)
    .select('id')
    .single()
  if (error) fail(`sides.insert ${spec.catalogKey}: ${error.message}`)
  return data.id
}

const FIXED_ITEMS = [
  {
    order: 1,
    itemKey: 'PICANHA_ANGUS',
    catalogKey: 'PICANHA_ANGUS',
    label_pt: 'Picanha Angus',
    label_en: 'Angus Picanha',
    label_es: 'Picaña Angus',
  },
  {
    order: 2,
    itemKey: 'PICANHA_WAGYU',
    catalogKey: 'PICANHA_WAGYU',
    label_pt: 'Picanha Wagyu',
    label_en: 'Wagyu Picanha',
    label_es: 'Picaña Wagyu',
  },
  {
    order: 3,
    itemKey: 'FRALDINHA',
    catalogKey: 'FRALDINHA_ANGUS',
    label_pt: 'Fraldinha Angus',
    label_en: 'Angus Fraldinha',
    label_es: 'Entraña Angus',
  },
  {
    order: 4,
    itemKey: 'carre_cordeiro',
    catalogKey: 'CARRE_CORDEIRO',
    label_pt: 'Carré de cordeiro',
    label_en: 'Rack of lamb',
    label_es: 'Costillar de cordero',
  },
  {
    order: 5,
    itemKey: 'ITEM_LINGUICA_TOSCANA_TRADICIONAL',
    catalogKey: 'LINGUICA',
    label_pt: 'Linguiça Toscana (Tradicional)',
    label_en: 'Traditional Tuscan sausage',
    label_es: 'Salchicha toscana tradicional',
  },
  {
    order: 6,
    itemKey: 'FRANGO',
    catalogKey: 'FRANGO',
    label_pt: 'Frango',
    label_en: 'Chicken',
    label_es: 'Pollo',
  },
  {
    order: 7,
    itemKey: 'PAO_DE_ALHO',
    catalogKey: 'PAO_DE_ALHO',
    label_pt: 'Pão de Alho',
    label_en: 'Garlic bread',
    label_es: 'Pan de ajo',
  },
  {
    order: 8,
    itemKey: 'QUEIJO_COALHO',
    catalogKey: 'QUEIJO',
    label_pt: 'Queijo Coalho',
    label_en: 'Coalho cheese',
    label_es: 'Queso coalho',
  },
  {
    order: 9,
    itemKey: 'MILHO',
    catalogKey: 'MILHO',
    label_pt: 'Milho',
    label_en: 'Corn',
    label_es: 'Maíz',
  },
]

const GROUPS = [
  {
    order: 1,
    key: 'LUXURY_LOBSTER_SCALLOP_CHOICE',
    label_pt: 'Lagosta ou Vieira com bacon',
    label_en: 'Lobster or scallops with bacon',
    label_es: 'Langosta o Vieira con bacon',
    items: [
      {
        order: 1,
        key: 'lagosta',
        catalogKey: 'LAGOSTA',
        label_pt: 'Lagosta',
        label_en: 'Lobster',
        label_es: 'Langosta',
      },
      {
        order: 2,
        key: 'vieira_com_bacon',
        catalogKey: 'VIEIRA',
        label_pt: 'Vieira com bacon',
        label_en: 'Scallops with bacon',
        label_es: 'Vieira con bacon',
      },
    ],
  },
  {
    order: 2,
    key: 'SEAFOOD_OPTION',
    label_pt: 'Escolha do Seafood',
    label_en: 'Seafood choice',
    label_es: 'Escolha do Seafood',
    items: [
      {
        order: 1,
        key: 'salmao',
        catalogKey: 'SALMAO',
        label_pt: 'Salmão',
        label_en: 'Salmon',
        label_es: 'Salmón',
      },
      {
        order: 2,
        key: 'camarao',
        catalogKey: 'CAMARAO',
        label_pt: 'Camarão',
        label_en: 'Shrimp',
        label_es: 'Camarón',
      },
    ],
  },
  {
    order: 3,
    key: 'COSTELA_OPTION',
    label_pt: 'Escolha da Costela',
    label_en: 'Rib choice',
    label_es: 'Escolha da Costela',
    items: [
      {
        order: 1,
        key: 'costela_porco',
        catalogKey: 'COSTELA_PORCO',
        label_pt: 'Costela de Porco',
        label_en: 'Pork Ribs',
        label_es: 'Costilla de Cerdo',
      },
      {
        order: 2,
        key: 'costela_bovina_angus',
        catalogKey: 'COSTELA_BOI',
        label_pt: 'Costela de Boi',
        label_en: 'Beef Ribs',
        label_es: 'Costilla de Res',
      },
    ],
  },
]

const SIDE_GROUP = {
  order: 30,
  key: 'SIDE_OPTION',
  label_pt: 'Escolha da Guarnição',
  label_en: 'Side choice',
  label_es: 'Escolha da Guarnição',
  items: [
    {
      order: 1,
      key: 'vinagrete',
      catalogKey: 'VINAGRETE',
      label_pt: 'Vinagrete',
      label_en: 'Vinagrete',
      label_es: 'Vinagrete',
    },
    {
      order: 2,
      key: 'salada_cesar',
      catalogKey: 'CESAR',
      label_pt: 'Salada César',
      label_en: 'Caesar salad',
      label_es: 'Ensalada César',
    },
  ],
}

const SIDES = [
  {
    order: 1,
    catalogKey: 'ARROZ',
    label_pt: 'Arroz Branco',
    label_en: 'WHITE RICE',
    label_es: 'ARROZ BLANCO',
  },
  {
    order: 2,
    catalogKey: 'FEIJAO',
    label_pt: 'Feijão Preto',
    label_en: 'BLACK BEANS',
    label_es: 'FRIJOLES NEGROS',
  },
  {
    order: 3,
    catalogKey: 'MAIONESE',
    label_pt: 'Maionese',
    label_en: 'POTATO SALAD',
    label_es: 'ENSALADA DE PAPA',
  },
]

async function configurePackage(packageId, withSides, catalog) {
  for (const item of FIXED_ITEMS) {
    await upsertItem(packageId, item, catalog)
  }
  const groups = withSides ? [...GROUPS, SIDE_GROUP] : GROUPS
  for (const group of groups) {
    const groupId = await upsertGroup(packageId, group)
    for (const item of group.items) {
      await upsertGroupItem(groupId, item, catalog)
    }
  }
  if (withSides) {
    for (const side of SIDES) {
      await upsertSide(packageId, side, catalog)
    }
  }
}

const existingPackages = await must(
  'packages',
  sb
    .from('packages')
    .select('id,package_key,package_name,label_pt,price_per_person,active,display_order')
    .eq('company_id', COMPANY_ID),
)

const luxuryHits = existingPackages.filter((row) =>
  /LUXURY|BBQLUX|\bLUX\b/i.test(
    `${row.package_key} ${row.package_name} ${row.label_pt}`,
  ),
)
const beforePrices = Object.fromEntries(
  existingPackages
    .filter((row) => FROZEN_PRICES[row.package_key] != null)
    .map((row) => [row.package_key, Number(row.price_per_person)]),
)

console.log('ENVIRONMENT=DEV')
console.log('COMPANY=CDL DEV')
console.log('PROD_WRITE=FORBIDDEN')
console.log(`LUXURY_HITS_BEFORE=${luxuryHits.length}`)
console.log('PRICE_FREEZE_BEFORE', beforePrices)

if (!APPLY) {
  console.log('DRY-RUN — no writes. Re-run with --apply.')
  process.exit(0)
}

const catalogRows = await must(
  'catalog_items',
  sb
    .from('catalog_items')
    .select('id,item_key,label_pt')
    .eq('company_id', COMPANY_ID)
    .in('item_key', Object.values(CATALOG)),
)
const catalog = Object.fromEntries(
  Object.entries(CATALOG).map(([alias, itemKey]) => {
    const row = catalogRows.find((item) => item.item_key === itemKey)
    if (!row) fail(`Catalog item missing: ${itemKey}`)
    return [alias, row]
  }),
)

const baseId = await upsertPackage(packagePayload(false))
const plusId = await upsertPackage(packagePayload(true))
await configurePackage(baseId, false, catalog)
await configurePackage(plusId, true, catalog)

const afterPackages = await must(
  'packages.after',
  sb
    .from('packages')
    .select('id,package_key,price_per_person,active')
    .eq('company_id', COMPANY_ID),
)
const afterByKey = Object.fromEntries(
  afterPackages.map((row) => [row.package_key, row]),
)

for (const [key, price] of Object.entries(FROZEN_PRICES)) {
  if (Number(afterByKey[key]?.price_per_person) !== price) {
    fail(`PRICE FREEZE BROKEN ${key} ${afterByKey[key]?.price_per_person}`)
  }
}

const family = afterPackages.filter((row) =>
  /^(BBQLUX\+?)$/i.test(row.package_key || ''),
)
if (family.length !== 2) fail(`LUXURY_PACKAGE_FAMILY_COUNT=${family.length}`)

console.log('BBQLUX', baseId, 150)
console.log('BBQLUX+', plusId, 163)
console.log('LUXURY_PACKAGE_FAMILY_COUNT=1')
console.log('APPLY_OK')
process.exit(0)
