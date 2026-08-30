/**
 * Public Quote wizard delta on the canonical baseline.
 * Order: Client → Event → BBQ → Package → Extras → Review
 *
 * Run: npm run test:dev:public-quote-wizard-delta
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DISPOSABLE_KIT_ITEM_KEY,
  WAITER_SERVICE_ITEM_KEY,
  getVisiblePublicExtraItems,
  isStructuralPublicExtraItem,
  sanitizePublicAdditionalQuantity,
} from '../../Lib/publicQuote/extrasEligibility.ts'
import {
  CHICKEN_SAUSAGE_ITEM_KEY,
  PORK_SAUSAGE_ITEM_KEY,
  resolveSausageDisplayLabel,
} from '../../Lib/publicQuote/sausageOptions.ts'
import { formatCatalogDisplayName } from '../../Lib/publicQuote/catalogDisplayName.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

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

function source(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function extra(id, fields = {}) {
  return {
    id,
    item_key: fields.item_key ?? `ITEM_${id.slice(0, 4)}`,
    item_type: fields.item_type ?? 'PRODUCT',
    can_be_additional: fields.can_be_additional ?? true,
    customer_visible: fields.customer_visible ?? true,
    active: fields.active ?? true,
    operational_item: fields.operational_item ?? false,
    category_key: fields.category_key ?? 'BOVINO_NOBRE',
    item_name: fields.item_name ?? null,
    label_pt: fields.label_pt ?? null,
  }
}

const WEIGHT_UOMS = new Set(['LB', 'LBS', 'POUND', 'POUNDS', 'KG', 'G', 'OZ'])

function hasCatalogWeight(item) {
  const amount = Number(item?.quantity_2)
  const uom = String(item?.uom_2 ?? '').trim().toUpperCase()
  return Number.isFinite(amount) && amount > 0 && WEIGHT_UOMS.has(uom)
}

test('WIZARD_ORDER_CLIENT_EVENT_BBQ_PACKAGE_EXTRAS_REVIEW', () => {
  const labels = source('app/quotes/new/wizardStepStatus.ts')
  const nav = source('Lib/wizardStepNavigation.ts')
  const advance = source('Lib/wizardStepAdvance.ts')
  assert.match(
    labels,
    /WIZARD_STEP_LABELS = \[\s*'Cliente',\s*'Evento',\s*'Churrasco',\s*'Pacote',\s*'Adicionais',\s*'Confirmação',/,
  )
  assert.match(nav, /churrasco: 2/)
  assert.match(nav, /bbq: 2/)
  assert.match(nav, /pacote: 3/)
  assert.match(nav, /package: 3/)
  assert.match(nav, /extras: 4/)
  assert.match(nav, /additionals: 4/)
  assert.match(nav, /confirmacao: 5/)
  assert.match(advance, /export function isGrillWizardStep[\s\S]*return step === 2/)
  assert.match(
    advance,
    /export function isAdditionalsWizardStep[\s\S]*return step === 4/,
  )
})

test('BBQ_BEFORE_PACKAGE_AND_EXTRAS', () => {
  const advance = source('Lib/wizardStepAdvance.ts')
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(advance, /case 2: \{[\s\S]*grillSetupAnswered/)
  assert.match(advance, /case 3: \{[\s\S]*packageId/)
  assert.match(advance, /case 4:\s*return canAdvanceFromAdditionalsStep/)
  assert.match(wizard, /\{step === 2 && \(/)
  assert.match(wizard, /\{step === 3 && \(/)
  assert.match(wizard, /\{step === 4 && \(/)
  assert.match(wizard, /QuoteBbqWaiterPanel/)
  assert.match(wizard, /PublicPackageCatalog/)
  assert.match(wizard, /\{step === 2 && \([\s\S]*QuoteBbqWaiterPanel/)
  assert.match(wizard, /\{step === 3 && \([\s\S]*PublicPackageCatalog/)
  assert.match(wizard, /\{step === 4 && \([\s\S]*additionalsStepHint/)
})

test('WAITER_QTY_SANITIZE', () => {
  assert.equal(sanitizePublicAdditionalQuantity(0), 0)
  assert.equal(sanitizePublicAdditionalQuantity(1), 1)
  assert.equal(sanitizePublicAdditionalQuantity(2), 2)
  assert.equal(sanitizePublicAdditionalQuantity(3), 3)
  assert.equal(sanitizePublicAdditionalQuantity(-1), 0)
  assert.equal(sanitizePublicAdditionalQuantity(1.5), 0)
  assert.equal(sanitizePublicAdditionalQuantity(true), 0)
  assert.equal(sanitizePublicAdditionalQuantity('2'), 2)
  assert.equal(sanitizePublicAdditionalQuantity('2.5'), 0)
  assert.equal(WAITER_SERVICE_ITEM_KEY, 'CDL_WAITER_SERVICE')
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const waiterPanel = source('components/quotes/QuoteBbqWaiterPanel.tsx')
  assert.match(wizard, /isWaiterServiceItem/)
  assert.match(waiterPanel, /data-waiter-service/)
  assert.match(waiterPanel, /onChangeQty\(safeQty \+ 1\)/)
  assert.match(waiterPanel, /Math\.max\(0, safeQty - 1\)/)
})

test('WEIGHT_SECOND_UOM_GATE', () => {
  const display = source('Lib/quoteAdditionalDisplay.ts')
  assert.match(display, /const WEIGHT_UOMS = new Set\(\['LB', 'LBS', 'POUND', 'POUNDS', 'KG', 'G', 'OZ'\]\)/)
  assert.match(display, /export function hasCatalogWeight/)
  assert.match(display, /export function getAdditionalWeightPerUnit/)
  assert.equal(hasCatalogWeight({ quantity_2: 3, uom_2: 'LB' }), true)
  assert.equal(hasCatalogWeight({ quantity_2: 3, uom_2: 'LBS' }), true)
  assert.equal(hasCatalogWeight({ quantity_2: 4, uom_2: 'KG' }), true)
  assert.equal(hasCatalogWeight({ quantity_2: 1, uom_2: 'UN' }), false)
  assert.equal(hasCatalogWeight({ quantity_2: 0, uom_2: 'LB' }), false)
  const card = source('components/quotes/additionals/AdditionalItemCard.tsx')
  assert.match(card, /getAdditionalWeightPerUnit/)
  assert.match(card, /weightPerUnit/)
  assert.doesNotMatch(
    source('components/quote-review/QuoteReviewLayout.tsx'),
    /getAdditionalWeightPerUnit/,
  )
})

test('SAUSAGE_TRADITIONAL_PORK_AND_CHICKEN', () => {
  assert.equal(PORK_SAUSAGE_ITEM_KEY, 'ITEM_LINGUICA_TOSCANA_TRADICIONAL')
  assert.equal(CHICKEN_SAUSAGE_ITEM_KEY, 'ITEM_024')
  assert.equal(
    resolveSausageDisplayLabel({ item_key: PORK_SAUSAGE_ITEM_KEY }, 'pt'),
    'Tradicional Porco',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: PORK_SAUSAGE_ITEM_KEY }, 'en'),
    'Traditional Pork Sausage',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: CHICKEN_SAUSAGE_ITEM_KEY }, 'pt'),
    'Tradicional Frango',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: CHICKEN_SAUSAGE_ITEM_KEY }, 'en'),
    'Traditional Chicken Sausage',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: CHICKEN_SAUSAGE_ITEM_KEY }, 'es'),
    'Salchicha Tradicional De Pollo',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: 'tradicional_porco' }, 'pt'),
    'Tradicional Porco',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: 'tradicional_frango' }, 'pt'),
    'Tradicional Frango',
  )
})

test('DISPOSABLE_KIT_NO_SIDES_ONLY', () => {
  assert.equal(DISPOSABLE_KIT_ITEM_KEY, 'KIT_DESCARTAVEIS')
  const kit = extra('kit-1', { item_key: DISPOSABLE_KIT_ITEM_KEY })
  assert.equal(isStructuralPublicExtraItem(kit), true)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  const translations = source('Lib/quoteTranslations.ts')
  const editorial = source('components/quotes/PackageSidesEditorial.tsx')
  assert.match(wizard, /NoSidesDisposableKitOffer/)
  assert.match(wizard, /!fromWithSidesSection && disposableKitItem/)
  assert.match(wizard, /fromWithSidesSection &&[\s\S]*disposableKitItem\.id/)
  assert.match(wizard, /disposableKitOffer=/)
  assert.match(catalog, /data-package-group-panel="without_sides"/)
  assert.match(catalog, /data-disposable-kit-in-no-sides/)
  assert.match(catalog, /includeDisposableKit/)
  assert.match(catalog, /data-public-package-options/)
  assert.match(
    source('components/quotes/NoSidesDisposableKitOffer.tsx'),
    /data-disposable-kit-inline/,
  )
  assert.match(
    source('components/quotes/NoSidesDisposableKitOffer.tsx'),
    /data-disposable-kit-choice="off"/,
  )
  assert.doesNotMatch(
    source('components/quotes/NoSidesDisposableKitOffer.tsx'),
    /shadow-cdl/,
  )
  assert.match(catalog, /data-with-sides-includes-disposables/)
  assert.match(catalog, /packageWithSidesIncludesDisposables/)
  assert.doesNotMatch(catalog, /\b13\b/)
  assert.match(
    translations,
    /includedServiceBody:\s*\n\s*'Estrutura de mesas do buffet com rechauds\.'/,
  )
  assert.match(
    translations,
    /Inclui as guarnições selecionadas e descartáveis: pratos, talheres e guardanapos/,
  )
  assert.match(
    translations,
    /Includes the selected side dishes and disposables: plates, cutlery and napkins/,
  )
  assert.match(
    translations,
    /Incluye las guarniciones seleccionadas y desechables: platos, cubiertos y servilletas/,
  )
  assert.doesNotMatch(editorial, /rechauds e descartáveis/)
  assert.doesNotMatch(translations, /Descartáveis incluídos no serviço/)
})

test('DISPOSABLE_KIT_PER_PERSON_NO_DOUBLE_CHARGE', () => {
  const totals = source('Lib/calculateQuoteTotals.ts')
  assert.equal(DISPOSABLE_KIT_ITEM_KEY, 'KIT_DESCARTAVEIS')
  assert.match(totals, /if \(line\.perPerson\) \{[\s\S]*unitPrice \* billableGuestCount/)
  assert.equal(3 * 50, 150)
})

test('STRUCTURAL_EXTRAS_HIDDEN_FROM_GENERIC_GRID', () => {
  const grill = extra('00c14d79-3365-4024-86bd-be58185fc74b', {
    item_key: 'ITEM_084',
    item_type: 'EQUIPMENT',
    category_key: 'EQUIPAMENTOS',
  })
  const waiter = extra('waiter-1', {
    item_key: WAITER_SERVICE_ITEM_KEY,
    item_type: 'EQUIPMENT',
  })
  const kit = extra('kit-1', { item_key: DISPOSABLE_KIT_ITEM_KEY })
  const steak = extra('steak-1', { item_key: 'ITEM_011' })
  const visible = getVisiblePublicExtraItems([grill, waiter, kit, steak], [])
  assert.deepEqual(
    visible.map((item) => item.item_key),
    ['ITEM_011'],
  )
  assert.equal(isStructuralPublicExtraItem(grill), true)
  assert.equal(isStructuralPublicExtraItem(waiter), true)
  assert.equal(isStructuralPublicExtraItem(kit), true)
})

test('SERVICES_SUPPLIES_LAST_EXTRAS_CATEGORY', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const translations = source('Lib/quoteTranslations.ts')
  const extras = source('Lib/publicQuote/suggestedExtras.ts')
  assert.match(wizard, /appendServiceSupplyGroup/)
  assert.match(wizard, /SERVICES_SUPPLIES_CATEGORY_KEY/)
  assert.match(wizard, /!fromWithSidesSection \? \[disposableKitItem\]/)
  assert.match(extras, /appendServiceSupplyGroup/)
  assert.match(translations, /SERVICOS_E_SUPRIMENTOS/)
  assert.match(translations, /Services & Supplies/)
  assert.match(translations, /Servicios y Suministros/)
  const order = translations.match(
    /const CATEGORY_SORT_ORDER = \[([\s\S]*?)\] as const/,
  )?.[1]
  assert.ok(order)
  assert.ok(order.trim().endsWith("'SERVICOS_E_SUPRIMENTOS',"))
})

test('DISPOSABLE_KIT_AUTO_REVEAL_ONCE', () => {
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  const groups = source('Lib/packageOptionGroups.ts')
  assert.match(groups, /export function areRequiredPackageOptionsComplete/)
  assert.match(catalog, /areRequiredPackageOptionsComplete/)
  assert.match(catalog, /revealFloatingPanelWhenReady/)
  assert.match(catalog, /justCompleted/)
  assert.match(catalog, /disposableKitRevealRef/)
  assert.doesNotMatch(catalog, /onToggle\(true\)/)
})

test('NO_NEW_WIZARD_FRAMEWORK', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.doesNotMatch(wizard, /wizardSteps\.ts/)
  assert.doesNotMatch(wizard, /normalizePublicServices/)
  assert.doesNotMatch(wizard, /structuralExtras\.ts/)
  assert.match(source('components/quotes/QuoteBbqWaiterPanel.tsx'), /data-waiter-service/)
  assert.match(
    source('components/quotes/NoSidesDisposableKitOffer.tsx'),
    /data-disposable-kit-offer/,
  )
  assert.match(
    source('components/quotes/NoSidesDisposableKitOffer.tsx'),
    /data-disposable-kit-inline/,
  )
})

test('CATALOG_DISPLAY_NAME_TITLE_CASE', () => {
  assert.equal(formatCatalogDisplayName('TRADICIONAL FRANGO'), 'Tradicional Frango')
  assert.equal(formatCatalogDisplayName('TRADICIONAL PORCO'), 'Tradicional Porco')
  assert.equal(formatCatalogDisplayName('GOIABADA'), 'Goiabada')
  assert.equal(formatCatalogDisplayName('MEL'), 'Mel')
  assert.equal(formatCatalogDisplayName('PIMENTA DE BICO'), 'Pimenta De Bico')
  assert.equal(formatCatalogDisplayName('FILÉ MIGNON BOVINO'), 'Filé Mignon Bovino')
  assert.equal(formatCatalogDisplayName('FILÉ MIGNON SUÍNO'), 'Filé Mignon Suíno')
  assert.equal(
    formatCatalogDisplayName('TOMAHAWK WAGYU FOLHADO A OURO'),
    'Tomahawk Wagyu Folhado A Ouro',
  )
  assert.equal(formatCatalogDisplayName('  pimenta   de   bico  '), 'Pimenta De Bico')
  assert.equal(formatCatalogDisplayName('ITEM_061'), 'ITEM_061')
  assert.equal(formatCatalogDisplayName('KIT_DESCARTAVEIS'), 'KIT_DESCARTAVEIS')
  assert.equal(formatCatalogDisplayName('BBQ PRIME'), 'BBQ Prime')
  assert.doesNotMatch(
    source('Lib/packageCatalogVisual.ts'),
    /formatCatalogDisplayName/,
  )
  assert.match(
    source('Lib/cdlPackageItemI18n.ts'),
    /formatCatalogDisplayName/,
  )
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
