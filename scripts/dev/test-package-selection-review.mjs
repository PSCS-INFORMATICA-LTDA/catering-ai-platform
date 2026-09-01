/**
 * Review must show the selected package choice and never a conflicting placeholder.
 *
 * Run: npm run test:dev:package-selection-review
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  CHICKEN_SAUSAGE_OPTION_KEY,
  PORK_SAUSAGE_OPTION_KEY,
  resolveSausageDisplayLabel,
} from '../../Lib/publicQuote/sausageOptions.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

let passed = 0
let failed = 0

function test(name, callback) {
  try {
    callback()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

const mapper = source('components/quote-review/mapWizardToQuoteReview.ts')
const helper = source('Lib/packageConfiguration.ts')

const PACKAGE_ID = 'pkg-bbqtrad'
const packageItems = [
  {
    id: 'fixed-1',
    package_id: PACKAGE_ID,
    item_key: 'ITEM_PICANHA',
    label_pt: 'Picanha (ANGUS)',
    is_choice_placeholder: false,
  },
  {
    id: 'placeholder-pork',
    package_id: PACKAGE_ID,
    item_key: 'ITEM_LINGUICA_TOSCANA_TRADICIONAL',
    additional_item_id: 'add-pork',
    label_pt: 'Tradicional Porco',
    is_choice_placeholder: true,
  },
]

const optionGroupItems = [
  {
    id: 'opt-pork',
    option_group_id: 'LINGUICA_OPTION',
    additional_item_id: 'add-pork',
    option_item_key: 'tradicional_porco',
    label_pt: 'Tradicional Porco',
  },
  {
    id: 'opt-chicken',
    option_group_id: 'LINGUICA_OPTION',
    additional_item_id: 'add-chicken',
    option_item_key: 'tradicional_frango',
    label_pt: 'Tradicional Frango',
  },
]

function naivePackageItemsText(items) {
  return items.map((item) => item.label_pt).filter(Boolean).join(' • ')
}

function displayableFixedItems(items, groupItems) {
  const choiceIds = new Set(
    groupItems.map((item) => item.additional_item_id?.trim()).filter(Boolean),
  )
  const choiceKeys = new Set(
    groupItems.map((item) => item.option_item_key?.trim()).filter(Boolean),
  )
  return items.filter((item) => {
    if (item.is_choice_placeholder === true) return false
    if (item.additional_item_id && choiceIds.has(item.additional_item_id)) return false
    if (item.item_key && choiceKeys.has(item.item_key)) return false
    return true
  })
}

test('MAPPER_USES_DISPLAYABLE_FIXED_HELPER', () => {
  assert.match(mapper, /formatDisplayableFixedPackageItemsText/)
  assert.match(mapper, /buildPackageSelectionLabels/)
  assert.match(helper, /export function getDisplayableFixedPackageItems/)
  assert.match(helper, /if \(item\.is_choice_placeholder === true\) return false/)
  assert.match(helper, /isConfiguredPackageChoiceItem/)
  assert.doesNotMatch(mapper, /formatPackageItemsText\(/)
  assert.doesNotMatch(mapper, /resolvePackageItemsWithSelections/)
  assert.doesNotMatch(mapper, /Tradicional Porco/)
})

test('BUG_REPRODUCED_BEFORE_HELPER', () => {
  const naive = naivePackageItemsText(packageItems)
  assert.match(naive, /Tradicional Porco/)
  const fixed = displayableFixedItems(packageItems, optionGroupItems)
    .map((item) => item.label_pt)
    .join(' · ')
  assert.doesNotMatch(fixed, /Tradicional Porco/)
  assert.doesNotMatch(fixed, /Tradicional Frango/)
  assert.match(fixed, /Picanha \(ANGUS\)/)
})

test('CHICKEN_SELECTED_NOT_DUPLICATED', () => {
  const selected = resolveSausageDisplayLabel(
    { option_item_key: CHICKEN_SAUSAGE_OPTION_KEY },
    'pt',
  )
  const fixed = displayableFixedItems(packageItems, optionGroupItems)
    .map((item) => item.label_pt)
    .join(' · ')
  assert.equal(selected, 'Tradicional Frango')
  assert.doesNotMatch(fixed, /Tradicional Frango/)
  assert.doesNotMatch(fixed, /Tradicional Porco/)
})

test('PORK_SELECTED_NOT_DUPLICATED', () => {
  const selected = resolveSausageDisplayLabel(
    { option_item_key: PORK_SAUSAGE_OPTION_KEY },
    'pt',
  )
  const fixed = displayableFixedItems(packageItems, optionGroupItems)
    .map((item) => item.label_pt)
    .join(' · ')
  assert.equal(selected, 'Tradicional Porco')
  assert.doesNotMatch(fixed, /Tradicional Porco/)
})

test('SAUSAGE_LABELS_PT_EN_ES', () => {
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: CHICKEN_SAUSAGE_OPTION_KEY }, 'pt'),
    'Tradicional Frango',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: CHICKEN_SAUSAGE_OPTION_KEY }, 'en'),
    'Traditional Chicken Sausage',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: CHICKEN_SAUSAGE_OPTION_KEY }, 'es'),
    'Salchicha Tradicional de Pollo',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: PORK_SAUSAGE_OPTION_KEY }, 'en'),
    'Traditional Pork Sausage',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: PORK_SAUSAGE_OPTION_KEY }, 'es'),
    'Salchicha Tradicional de Cerdo',
  )
})

test('OTHER_OPTION_GROUPS_PLACEHOLDERS_HIDDEN', () => {
  const extras = [
    {
      id: 'ph-rib',
      item_key: 'costela_porco',
      additional_item_id: 'add-rib-pork',
      label_pt: 'Costela de Porco',
      is_choice_placeholder: true,
    },
    {
      id: 'ph-fish',
      item_key: 'salmao',
      additional_item_id: 'add-salmon',
      label_pt: 'Salmão',
      is_choice_placeholder: true,
    },
    {
      id: 'fixed-rib',
      item_key: 'ITEM_PICANHA',
      label_pt: 'Picanha (ANGUS)',
    },
  ]
  const groupItems = [
    { additional_item_id: 'add-rib-pork', option_item_key: 'costela_porco' },
    { additional_item_id: 'add-rib-beef', option_item_key: 'costela_boi' },
    { additional_item_id: 'add-salmon', option_item_key: 'salmao' },
    { additional_item_id: 'add-shrimp', option_item_key: 'camarao' },
    { additional_item_id: 'add-rice', option_item_key: 'arroz' },
    { additional_item_id: 'add-lobster', option_item_key: 'lagosta' },
  ]
  const fixed = displayableFixedItems(extras, groupItems)
    .map((item) => item.label_pt)
    .join(' · ')
  assert.match(fixed, /Picanha \(ANGUS\)/)
  assert.doesNotMatch(fixed, /Costela de Porco|Costela de Boi/)
  assert.doesNotMatch(fixed, /Salmão|Camarão/)
  assert.doesNotMatch(fixed, /Lagosta/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: pkg, error: pkgErr } = await sb
  .from('packages')
  .select('id,package_key,label_pt,price_per_person')
  .eq('company_id', COMPANY_ID)
  .eq('package_key', 'BBQTRAD')
  .maybeSingle()
if (pkgErr) throw pkgErr
assert.ok(pkg?.id, 'BBQTRAD package missing in DEV')

const { data: liveItems, error: itemsErr } = await sb
  .from('package_items')
  .select(
    'id,package_id,additional_item_id,item_key,label_pt,label_en,label_es,is_choice_placeholder,active',
  )
  .eq('company_id', COMPANY_ID)
  .eq('package_id', pkg.id)
if (itemsErr) throw itemsErr

const { data: liveGroups, error: groupsErr } = await sb
  .from('package_option_groups')
  .select('id,package_id,option_group_key,label_pt,active')
  .eq('company_id', COMPANY_ID)
  .eq('package_id', pkg.id)
if (groupsErr) throw groupsErr

const { data: liveGroupItems, error: groupItemsErr } = await sb
  .from('package_option_group_items')
  .select(
    'id,option_group_id,additional_item_id,option_item_key,label_pt,label_en,label_es,active',
  )
  .eq('company_id', COMPANY_ID)
  .in(
    'option_group_id',
    (liveGroups ?? []).map((row) => row.id),
  )
if (groupItemsErr) throw groupItemsErr

test('DEV_BBQTRAD_HAS_PLACEHOLDER_AND_CHOICES', () => {
  const placeholders = (liveItems ?? []).filter(
    (row) => row.is_choice_placeholder === true,
  )
  assert.ok(placeholders.length >= 1, 'expected a choice placeholder on BBQTRAD')
  const linguica = (liveGroups ?? []).find((row) =>
    /LINGUICA/i.test(row.option_group_key ?? ''),
  )
  assert.ok(linguica, 'LINGUICA_OPTION missing')
  const choices = (liveGroupItems ?? []).filter(
    (row) => row.option_group_id === linguica.id,
  )
  assert.ok(choices.length >= 2, 'expected pork and chicken sausage choices')
})

test('DEV_BBQTRAD_CHICKEN_REVIEW', () => {
  const linguica = (liveGroups ?? []).find((row) =>
    /LINGUICA/i.test(row.option_group_key ?? ''),
  )
  const chicken = (liveGroupItems ?? []).find(
    (row) =>
      row.option_group_id === linguica.id &&
      /frango|chicken|pollo/i.test(
        `${row.option_item_key} ${row.label_pt} ${row.label_en} ${row.label_es}`,
      ),
  )
  const pork = (liveGroupItems ?? []).find(
    (row) =>
      row.option_group_id === linguica.id &&
      /porco|pork|cerdo/i.test(
        `${row.option_item_key} ${row.label_pt} ${row.label_en} ${row.label_es}`,
      ),
  )
  assert.ok(chicken && pork, 'sausage choices missing')
  const chickenLabel = resolveSausageDisplayLabel(chicken, 'pt') || chicken.label_pt
  const porkLabel = resolveSausageDisplayLabel(pork, 'pt') || pork.label_pt
  assert.equal(chickenLabel, 'Tradicional Frango')
  assert.equal(porkLabel, 'Tradicional Porco')
  const naive = naivePackageItemsText(liveItems ?? [])
  assert.match(naive, /Tradicional Porco/)
  const fixed = displayableFixedItems(liveItems ?? [], liveGroupItems ?? [])
    .map((item) => `${item.label_pt} ${item.label_en} ${item.label_es}`)
    .join(' · ')
  assert.doesNotMatch(fixed, /Tradicional Porco/)
  assert.doesNotMatch(fixed, /Tradicional Frango/)
  assert.doesNotMatch(fixed, /Traditional Pork Sausage|Traditional Chicken Sausage/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
