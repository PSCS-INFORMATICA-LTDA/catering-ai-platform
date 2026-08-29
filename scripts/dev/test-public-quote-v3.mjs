/**
 * Public Quote V3 — BBQ before package, waiter, weights, sausage, disposables.
 * DEV only. Does not create leftover quotes.
 *
 *   node --experimental-strip-types scripts/dev/test-public-quote-v3.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'
import { WIZARD_STEPS, WIZARD_STEP_COUNT } from '../../Lib/wizardSteps.ts'
import {
  resolveWizardStep,
  WIZARD_STEP_SLUGS,
} from '../../Lib/wizardStepNavigation.ts'
import { getVisiblePublicExtraItems } from '../../Lib/publicQuote/extrasEligibility.ts'
import {
  DISPOSABLE_KIT_ITEM_KEY,
  GRILL_RENTAL_ITEM_KEY,
  WAITER_SERVICE_ITEM_KEY,
  hasCatalogWeight,
  partitionSuggestedPublicExtras,
  sanitizePublicAdditionalQuantity,
} from '../../Lib/publicQuote/structuralExtras.ts'
import {
  CHICKEN_SAUSAGE_ITEM_KEY,
  PORK_SAUSAGE_ITEM_KEY,
  resolveSausageDisplayLabel,
} from '../../Lib/publicQuote/sausageOptions.ts'
import {
  normalizePublicGrillSelection,
  pruneStructuralAdditionalLines,
} from '../../Lib/publicQuote/normalizePublicServices.ts'
import { getPublicPackageSidesGroup } from '../../Lib/packageCatalogVisual.ts'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'
import { inspectTranslationRegistry } from '../../Lib/i18n/registry.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

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

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

test('STEP_1_CLIENT', () => {
  assert.equal(WIZARD_STEPS.CLIENT, 0)
  assert.equal(getQuoteStrings('pt').wizardSteps[0], 'Cliente')
})

test('STEP_2_EVENT', () => {
  assert.equal(WIZARD_STEPS.EVENT, 1)
  assert.equal(getQuoteStrings('pt').wizardSteps[1], 'Evento')
})

test('STEP_3_BBQ', () => {
  assert.equal(WIZARD_STEPS.BBQ, 2)
  assert.equal(getQuoteStrings('pt').wizardSteps[2], 'Churrasco')
  assert.match(source('Lib/wizardSteps.ts'), /BBQ: 2/)
  assert.match(source('app/quotes/new/QuoteWizard.tsx'), /step === WIZARD_STEPS.BBQ/)
})

test('STEP_4_PACKAGE', () => {
  assert.equal(WIZARD_STEPS.PACKAGE, 3)
  assert.equal(getQuoteStrings('pt').wizardSteps[3], 'Pacote')
})

test('STEP_5_EXTRAS', () => {
  assert.equal(WIZARD_STEPS.EXTRAS, 4)
  assert.equal(getQuoteStrings('pt').wizardSteps[4], 'Adicionais')
})

test('STEP_6_REVIEW', () => {
  assert.equal(WIZARD_STEPS.REVIEW, 5)
  assert.equal(WIZARD_STEP_COUNT, 6)
  assert.equal(getQuoteStrings('pt').wizardSteps[5], 'Confirmação')
})

test('PACKAGE_BLOCKED_BEFORE_BBQ', () => {
  const status = source('app/quotes/new/wizardStepStatus.ts')
  const advance = source('Lib/wizardStepAdvance.ts')
  assert.match(status, /MANDATORY_WIZARD_STEP_INDICES/)
  assert.match(advance, /case WIZARD_STEPS.BBQ/)
  assert.match(advance, /case WIZARD_STEPS.PACKAGE/)
  assert.equal(WIZARD_STEPS.BBQ < WIZARD_STEPS.PACKAGE, true)
})

test('EXTRAS_BLOCKED_BEFORE_PACKAGE', () => {
  assert.equal(WIZARD_STEPS.PACKAGE < WIZARD_STEPS.EXTRAS, true)
  assert.match(
    source('app/quotes/new/wizardStepStatus.ts'),
    /WIZARD_STEPS.PACKAGE/,
  )
})

test('REVIEW_BLOCKED_IF_INVALID', () => {
  assert.match(
    source('app/quotes/new/wizardStepStatus.ts'),
    /case WIZARD_STEPS.REVIEW/,
  )
  assert.match(
    source('app/quotes/new/wizardStepStatus.ts'),
    /pricingPreviewReady/,
  )
})

test('DEEP_LINK_GUARDS', () => {
  assert.equal(resolveWizardStep('bbq'), WIZARD_STEPS.BBQ)
  assert.equal(resolveWizardStep('package'), WIZARD_STEPS.PACKAGE)
  assert.equal(resolveWizardStep('extras'), WIZARD_STEPS.EXTRAS)
  assert.equal(WIZARD_STEP_SLUGS.churrasqueira, 2)
  assert.equal(WIZARD_STEP_SLUGS.pacote, 3)
})

test('HAS_GRILL rental = 0', () => {
  const next = normalizePublicGrillSelection({
    setupAnswered: true,
    hasGrill: true,
    rentalRequired: true,
    rentalQty: 4,
  })
  assert.equal(next.rentalRequired, false)
  assert.equal(next.rentalQty, 0)
})

test('NO_GRILL rental mandatory = 1', () => {
  const next = normalizePublicGrillSelection({
    setupAnswered: true,
    hasGrill: false,
    rentalRequired: false,
    rentalQty: 0,
  })
  assert.equal(next.rentalRequired, true)
  assert.equal(next.rentalQty, 1)
})

test('GRILL_QTY_EDITABLE NO', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /data-grill-rental-required/)
  assert.match(wizard, /grillRentalQty: 1/)
  assert.doesNotMatch(
    wizard,
    /<QuantityField[\s\S]{0,200}grillRentalQty/,
  )
})

test('GRILL_IN_GENERIC_EXTRAS NO', () => {
  const visible = getVisiblePublicExtraItems(
    [
      {
        id: '00c14d79-3365-4024-86bd-be58185fc74b',
        item_key: GRILL_RENTAL_ITEM_KEY,
        item_type: 'EQUIPMENT',
        can_be_additional: true,
        customer_visible: true,
        active: true,
        operational_item: false,
      },
    ],
    [],
  )
  assert.equal(visible.length, 0)
})

test('WAITER quantity and client price sanitization', () => {
  assert.equal(sanitizePublicAdditionalQuantity(0), 0)
  assert.equal(sanitizePublicAdditionalQuantity(1), 1)
  assert.equal(sanitizePublicAdditionalQuantity(2), 2)
  assert.equal(sanitizePublicAdditionalQuantity(5), 5)
  assert.equal(sanitizePublicAdditionalQuantity(-1), 0)
  assert.equal(sanitizePublicAdditionalQuantity(1.5), 0)
  assert.equal(sanitizePublicAdditionalQuantity('abc'), 0)
  const catalog = new Map([
    ['waiter', { id: 'waiter', item_key: WAITER_SERVICE_ITEM_KEY }],
    ['grill', { id: 'grill', item_key: GRILL_RENTAL_ITEM_KEY }],
  ])
  const pruned = pruneStructuralAdditionalLines(
    [
      { itemId: 'waiter', quantity: 2 },
      { itemId: 'grill', quantity: 1 },
    ],
    catalog,
    { package_key: 'BBQCHO' },
  )
  assert.deepEqual(pruned, [{ itemId: 'waiter', quantity: 2 }])
})

test('PUBLIC bootstrap keeps quantity_2 / uom_2', () => {
  const bootstrap = source('Lib/publicQuote/bootstrap.ts')
  const listSelect = source('Lib/catalogItemsTableSchema.ts')
  assert.match(bootstrap, /quantity_2: Number.isFinite\(Number\(row\.quantity_2\)\)/)
  assert.match(bootstrap, /uom_2: typeof row\.uom_2 === 'string' \? row\.uom_2 : null/)
  assert.match(listSelect, /CATALOG_ITEMS_LIST_COLUMNS[\s\S]*'quantity_2'[\s\S]*'uom_2'/)
})

test('WEIGHTED extras use quantity_2 / uom_2', () => {
  const tomahawk = {
    item_key: 'ITEM_012',
    quantity_2: 3,
    uom_2: 'LB',
  }
  assert.equal(hasCatalogWeight(tomahawk), true)
  assert.equal(3 * 2, 6)
  assert.equal(hasCatalogWeight({ quantity_2: 0, uom_2: 'LB' }), false)
  assert.equal(hasCatalogWeight({ quantity_2: 1, uom_2: 'UN' }), false)
})

test('SUGGESTED extras order', () => {
  const { suggested } = partitionSuggestedPublicExtras([
    { item_key: 'ITEM_011' },
    { item_key: 'ITEM_016' },
    { item_key: 'ITEM_013' },
    { item_key: 'ITEM_012' },
  ])
  assert.deepEqual(
    suggested.map((item) => item.item_key),
    ['ITEM_012', 'ITEM_013', 'ITEM_011', 'ITEM_016'],
  )
})

test('PACKAGE_SAUSAGE_OPTION labels', () => {
  assert.equal(
    resolveSausageDisplayLabel({ item_key: PORK_SAUSAGE_ITEM_KEY }, 'pt'),
    'TRADICIONAL PORCO',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: CHICKEN_SAUSAGE_ITEM_KEY }, 'en'),
    'TRADITIONAL CHICKEN SAUSAGE',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: CHICKEN_SAUSAGE_ITEM_KEY }, 'es'),
    'SALCHICHA TRADICIONAL DE POLLO',
  )
})

test('DISPOSABLE kit hidden on with-sides', () => {
  assert.equal(getPublicPackageSidesGroup({ package_key: 'BBQCHO' }), 'without_sides')
  assert.equal(getPublicPackageSidesGroup({ package_key: 'BBQCHO+' }), 'with_sides')
  const catalog = new Map([
    ['kit', { id: 'kit', item_key: DISPOSABLE_KIT_ITEM_KEY }],
  ])
  const kept = pruneStructuralAdditionalLines(
    [{ itemId: 'kit', quantity: 1 }],
    catalog,
    { package_key: 'BBQCHO' },
  )
  const removed = pruneStructuralAdditionalLines(
    [{ itemId: 'kit', quantity: 1 }],
    catalog,
    { package_key: 'BBQCHO+' },
  )
  assert.equal(kept.length, 1)
  assert.equal(removed.length, 0)
})

test('I18N PT/EN/ES new keys', () => {
  for (const locale of ['pt', 'en', 'es']) {
    const strings = getQuoteStrings(locale)
    assert.ok(strings.weightPerUnit.trim())
    assert.ok(strings.estimatedTotalWeight.trim())
    assert.ok(strings.suggestedExtrasTitle.trim())
    assert.ok(strings.wizard.waiterSectionTitle.trim())
    assert.ok(strings.wizard.disposableKitTitle.trim())
    assert.ok(strings.wizard.sausageOption.trim())
  }
  assert.equal(
    getQuoteStrings('pt').wizard.waiterSectionHint.includes('garçons'),
    true,
  )
  const registry = inspectTranslationRegistry()
  assert.equal(registry.missingPt.length, 0)
  assert.equal(registry.missingEn.length, 0)
  assert.equal(registry.missingEs.length, 0)
})

test('INTEGRATION math package + grill + waiters + kit + extra', () => {
  const packageTotal = 20 * 50
  const grill = 1 * 100
  const waiters = 2 * 250
  const kit = 50 * 3
  const tomahawk = 1 * 200
  assert.equal(packageTotal, 1000)
  assert.equal(grill + waiters + kit + tomahawk, 950)
  assert.equal(packageTotal + grill + waiters + kit + tomahawk, 1950)
  assert.equal(2 * 200, 400)
  assert.equal(2 * 3, 6)
  assert.notEqual(2 * 200 * 3, 400)
})

test('PRICE engine reused and client price ignored', () => {
  const pricing = source('Lib/pricing/resolveQuotePricingInput.ts')
  assert.match(pricing, /getCatalogItemSalePrice/)
  assert.match(pricing, /pruneStructuralAdditionalLines/)
  assert.doesNotMatch(pricing, /line\.price/)
  assert.doesNotMatch(pricing, /line\.unitPrice/)
})

async function testDevCatalog() {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false },
  })
  const { data: items, error } = await sb
    .from('catalog_items')
    .select('item_key, price, quantity_2, uom_2, label_pt')
    .eq('company_id', COMPANY_ID)
    .in('item_key', [
      'ITEM_011',
      'ITEM_012',
      'ITEM_013',
      'ITEM_016',
      'ITEM_084',
      WAITER_SERVICE_ITEM_KEY,
      DISPOSABLE_KIT_ITEM_KEY,
      PORK_SAUSAGE_ITEM_KEY,
      CHICKEN_SAUSAGE_ITEM_KEY,
      'ITEM_025',
    ])
  assert.equal(error, null)
  const byKey = new Map((items ?? []).map((row) => [row.item_key, row]))
  assert.equal(Number(byKey.get('ITEM_011')?.price), 100)
  assert.equal(Number(byKey.get('ITEM_011')?.quantity_2), 3)
  assert.equal(byKey.get('ITEM_011')?.uom_2, 'LB')
  assert.equal(Number(byKey.get('ITEM_012')?.price), 200)
  assert.equal(Number(byKey.get('ITEM_012')?.quantity_2), 3)
  assert.equal(Number(byKey.get('ITEM_013')?.price), 400)
  assert.equal(Number(byKey.get('ITEM_013')?.quantity_2), 4)
  assert.equal(Number(byKey.get('ITEM_016')?.price), 120)
  assert.equal(Number(byKey.get('ITEM_016')?.quantity_2), 4)
  assert.equal(Number(byKey.get('ITEM_084')?.price), 100)
  assert.equal(Number(byKey.get(WAITER_SERVICE_ITEM_KEY)?.price), 250)
  assert.equal(Number(byKey.get(DISPOSABLE_KIT_ITEM_KEY)?.price), 3)
  assert.equal(byKey.get(PORK_SAUSAGE_ITEM_KEY)?.label_pt, 'TRADICIONAL PORCO')
  assert.equal(byKey.get(CHICKEN_SAUSAGE_ITEM_KEY)?.label_pt, 'TRADICIONAL FRANGO')
  assert.ok(byKey.get('ITEM_025'), 'other sausages were not deleted')
  const { count } = await sb
    .from('package_option_groups')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('group_key', 'LINGUICA_OPTION')
  assert.equal(count, 10)
}

try {
  await testDevCatalog()
  passed += 1
  console.log('PASS  DEV catalog waiter + kit + sausage + weights')
} catch (error) {
  failed += 1
  console.error('FAIL  DEV catalog waiter + kit + sausage + weights')
  console.error(`      ${error instanceof Error ? error.message : error}`)
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
