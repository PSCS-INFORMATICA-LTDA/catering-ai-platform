/**
 * Commercial UX gates: the package accompaniments/sides explainer, the extras
 * opening, the commercial category order and the price-descending item sort.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-upsell.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (p) => readFileSync(join(ROOT, p), 'utf8')

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

const translations = source('Lib/quoteTranslations.ts')
const rules = source('Lib/cdlCommercialRules.ts')
const editorial = source('components/quotes/PackageSidesEditorial.tsx')
const catalog = source('components/quotes/PublicPackageCatalog.tsx')
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const display = source('Lib/quoteAdditionalDisplay.ts')
const quoteDisplay = source('Lib/packageQuoteDisplay.ts')
const itemI18n = source('Lib/cdlPackageItemI18n.ts')
const css = source('app/globals.css')

test('PACKAGE_INCLUDED_ACCOMPANIMENTS_COPY', () => {
  assert.match(translations, /packageIncludedTitle: 'TODOS OS PACOTES ACOMPANHAM'/)
  assert.match(translations, /packageIncludedTitle: 'INCLUDED WITH EVERY PACKAGE'/)
  assert.match(translations, /packageIncludedTitle: 'INCLUIDO EN TODOS LOS PAQUETES'/)
  assert.match(translations, /packageIncludedHelper: 'Incluídos sem custo adicional\.'/)
  assert.match(translations, /packageIncludedHelper: 'Included at no additional charge\.'/)
  assert.match(translations, /packageIncludedHelper: 'Incluido sin costo adicional\.'/)
  assert.match(editorial, /packageIncludedTitle/)
  assert.match(catalog, /<PackageSidesEditorial/)
})

test('ACCOMPANIMENTS_COME_FROM_CANONICAL_CONFIG', () => {
  // The six the folder promises, read from the commercial rules.
  assert.match(editorial, /PACKAGE_COMMON_ITEMS/)
  for (const item of [
    'Chimichurri',
    'Farofa',
    'Mel',
    'Goiabada',
    'Pimenta de bico',
    'Geleia de pimenta',
  ]) {
    assert.match(rules, new RegExp(`'${item}'`), `${item} missing from config`)
  }
  // No second list was invented in the component.
  assert.doesNotMatch(editorial, /const .*=\s*\[\s*'/)
})

test('SIDES_LIST_CANONICAL_AND_BLACK_BEANS', () => {
  assert.match(quoteDisplay, /SIDES_ITEMS/)
  assert.match(editorial, /getPlusGuarnicoesFixedSideLabels/)
  for (const item of ['Arroz branco', 'Feijão preto', 'Vinagrete']) {
    assert.match(rules, new RegExp(`'${item}'`), `${item} missing from SIDES_ITEMS`)
  }
  // Nothing dropped silently: the config also carries these two.
  assert.match(rules, /'Farofa'/)
  assert.match(rules, /'Maionese'/)
  assert.doesNotMatch(rules, /'Mandioca'/)
  // Tropeiro must not reach the customer.
  assert.doesNotMatch(editorial, /tropeiro/i)
  const sidesBlock = rules.slice(
    rules.indexOf('export const SIDES_ITEMS'),
    rules.indexOf('export const SIDES_ITEMS') + 220,
  )
  assert.doesNotMatch(sidesBlock, /tropeiro/i)
})

test('BLACK_BEANS_PT_EN_ES', () => {
  assert.match(itemI18n, /'Feijão preto': \{ en: 'Black beans', es: 'Frijoles negros' \}/)
  assert.match(editorial, /translateCdlItemList/)
})

test('SIDES_UPSELL_COPY_AND_DYNAMIC_PRICE', () => {
  assert.match(translations, /packageSidesUpsellTitle: 'PLUS GUARNIÇÕES'/)
  assert.match(translations, /packageSidesUpsellTitle: 'PLUS SIDES'/)
  assert.match(translations, /packageSidesUpsellTitle: 'PLUS GUARNICIONES'/)
  assert.match(translations, /Adicione guarnições por \{price\} por pessoa\./)
  assert.match(translations, /Add sides for \{price\} per person\./)
  assert.match(translations, /Agrega guarniciones por \{price\} por persona\./)
  // The number comes from the prop the cards already price with.
  assert.match(editorial, /sidesPricePerPerson: number/)
  assert.match(editorial, /formatMoney\(sidesPricePerPerson\)/)
  assert.match(catalog, /sidesPricePerPerson=\{sidesPricePerPerson\}/)
})

test('SIDES_PRICE_NOT_HARDCODED', () => {
  // No literal 13 anywhere in the explainer, and no private constant.
  assert.doesNotMatch(editorial, /\b13\b/)
  assert.doesNotMatch(editorial, /SIDES_PRICE\s*=/)
  assert.doesNotMatch(editorial, /\$13/)
  // The rule remains the single source.
  assert.match(rules, /export const SIDES_PRICE_PER_PERSON = 13/)
})

test('SUGGESTED_EXTRAS_HEADER', () => {
  assert.match(translations, /suggestedExtrasTitle: 'EXTRAS SUGERIDOS'/)
  assert.match(translations, /suggestedExtrasTitle: 'SUGGESTED EXTRAS'/)
  assert.match(translations, /Selecionamos alguns dos cortes e extras premium/)
  assert.match(translations, /Explore a selection of premium cuts and extras/)
  assert.match(translations, /Descubre una selección de cortes premium y extras/)
  assert.match(wizard, /featured=\{categoryKey === SUGGESTED_EXTRAS_DISPLAY_KEY\}/)
  assert.match(css, /\.public-suggested-extras-header \{[\s\S]*?#070707/)
  assert.doesNotMatch(wizard, /data-suggested-extras[\s\S]{0,600}?(modal|carousel|popup|<img)/i)
})

test('NO_FAKE_RECOMMENDATION_BADGES', () => {
  for (const claim of [
    'Mais vendido',
    'Recomendado',
    'Melhor escolha',
    'Best seller',
    'Recommended',
    'Popular',
  ]) {
    assert.ok(
      !translations.includes(`'${claim}'`),
      `${claim} would be an unsupported claim`,
    )
  }
})

test('CATEGORY_ORDER_COMMERCIAL', () => {
  const block = translations.match(/const CATEGORY_SORT_ORDER = \[([\s\S]*?)\] as const/)?.[1]
  assert.ok(block, 'CATEGORY_SORT_ORDER missing')
  const order = [...block.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  // The twelve the brief asked for, in that relative order...
  const asked = [
    'BOVINO_NOBRE', 'BOVINO_TRADICIONAL', 'PORCO', 'CORDEIRO', 'FRANGO',
    'LINGUICAS', 'FRUTOS_DO_MAR', 'LEGUMES_E_VEGETAIS', 'FRUTAS',
    'ACOMPANHAMENTOS', 'GUARNICOES', 'EQUIPAMENTOS', 'OUTROS',
  ]
  assert.deepEqual(order.filter((k) => asked.includes(k)), asked)
  // ...plus the live categories the catalog actually has, all before OUTROS.
  for (const extra of ['ACOMPANHAMENTOS', 'LEGUMES_E_VEGETAIS', 'FRUTAS']) {
    assert.ok(order.includes(extra), `${extra} is in the catalog but unsorted`)
    assert.ok(
      order.indexOf(extra) < order.indexOf('OUTROS'),
      `${extra} must sort before OUTROS`,
    )
  }
  assert.equal(order[order.length - 1], 'OUTROS')
  assert.equal(order[0], 'BOVINO_NOBRE')
  assert.equal(order[1], 'BOVINO_TRADICIONAL')
  assert.equal(order[2], 'PORCO')
  assert.equal(order[3], 'CORDEIRO')
  assert.equal(order[4], 'FRANGO')
})

test('CATEGORY_ORDER_IS_DISPLAY_ONLY', () => {
  // Sorting is the only thing the order feeds.
  assert.match(translations, /export function getCategorySortIndex/)
  assert.match(translations, /export function compareCategoryKeys/)
  assert.match(display, /\.sort\(\(\[a\], \[b\]\) => compareCategoryKeys\(a, b\)\)/)
  // No category key, price or availability is derived from it.
  const sortFns = translations.slice(translations.indexOf('export function getCategorySortIndex'))
  assert.doesNotMatch(sortFns.slice(0, 600), /price|active|visible|eligib/i)
})

test('ITEMS_SORTED_PRICE_DESC', () => {
  // Existing maths preserved exactly, with a stable label tie-break.
  assert.match(display, /getAdditionalUnitPrice\(b\) - getAdditionalUnitPrice\(a\)/)
  const sortBlock = display.slice(
    display.indexOf('getAdditionalUnitPrice(b) - getAdditionalUnitPrice(a)') - 400,
    display.indexOf('getAdditionalUnitPrice(b) - getAdditionalUnitPrice(a)') + 400,
  )
  assert.match(sortBlock, /localeCompare|label/i)
})

test('CATEGORY_REVIEW_FLOW_UNCHANGED', () => {
  // Reordering must not touch the review requirement or its bookkeeping. Note
  // that the hard block on Next is already off on this branch — it was turned
  // off in 780f10b, "unblock extras and restore quote submission" — so this
  // asserts the plumbing is intact, not that Next is disabled.
  assert.match(wizard, /reviewedCategoryKeys/)
  assert.match(wizard, /additionalsStepNextDisabled/)
  assert.match(wizard, /additionalsReviewPrompt/)
  const exposure = source('Lib/additionalCategoryExposure.ts')
  assert.match(exposure, /export/)
  const accordion = source('components/quotes/additionals/AdditionalCategorySection.tsx')
  assert.match(accordion, /data-additional-category-sentinel/)
  assert.match(accordion, /data-additional-category-summary/)
})

test('EXTRAS_HEADER_IS_PURELY_ADDITIVE', () => {
  // Suggested extras is a display group on the same accordion, so review,
  // expose and quantity stay on the existing category machinery.
  const step = wizard.slice(wizard.indexOf('{step === 3 && ('))
  assert.match(step, /additionalItemsByCategory\.map/)
  assert.match(step, /featured=\{categoryKey === SUGGESTED_EXTRAS_DISPLAY_KEY\}/)
  assert.match(step, /quantities=\{state\.additionals\}/)
  assert.doesNotMatch(step, /suggestedExtrasState|promoQuantity|secondarySelection/)
})

test('PACKAGE_ACCOMPANIMENT_ITEMS_YELLOW', () => {
  const names = css.match(/\.public-package-editorial-names \{[\s\S]*?\n\}/)?.[0]
  assert.ok(names, 'yellow names class missing')
  assert.match(names, /color: #f6d000/)
  assert.doesNotMatch(names, /background:\s*#f6d000|background:\s*yellow/i)
  assert.match(editorial, /data-package-included-items/)
  assert.match(editorial, /public-package-editorial-names/)
  const helper = css.match(/\.public-package-editorial-helper \{[\s\S]*?\n\}/)?.[0]
  assert.match(helper, /rgba\(255, 255, 255, 0\.62\)/)
})

test('PACKAGE_FIXED_SIDES_YELLOW', () => {
  assert.match(editorial, /data-package-sides-items/)
  assert.match(editorial, /getPlusGuarnicoesFixedSideLabels/)
  assert.match(quoteDisplay, /getPlusGuarnicoesFixedSideItems/)
  assert.match(quoteDisplay, /isCommonPackageItem/)
  assert.match(quoteDisplay, /isSideChoiceItem/)
})

test('PACKAGE_FIXED_SIDES_DISPLAY', () => {
  const helper = quoteDisplay.slice(
    quoteDisplay.indexOf('export function getPlusGuarnicoesFixedSideItems'),
    quoteDisplay.indexOf('export function getPlusGuarnicoesFixedSideItems') + 500,
  )
  assert.match(helper, /SIDES_ITEMS\.filter/)
  assert.match(quoteDisplay, /!isCommonPackageItem\(name\)/)
  assert.match(quoteDisplay, /!isSideChoiceItem\(name, optionGroups\)/)
})

test('SIDE_CHOICE_HELPER_AND_CANONICAL_LABELS', () => {
  assert.match(translations, /packageSidesChoiceLead: 'Escolha 1 opção:'/)
  assert.match(translations, /packageSidesChoiceLead: 'Choose 1 option:'/)
  assert.match(translations, /packageSidesChoiceLead: 'Elige 1 opción:'/)
  assert.match(editorial, /getPlusGuarnicoesChoiceLabels/)
  assert.match(editorial, /data-package-sides-choice/)
  assert.match(quoteDisplay, /option_group_key\?\.trim\(\)\.toUpperCase\(\) === 'SIDE_OPTION'/)
  assert.match(quoteDisplay, /getOptionItemLabel/)
  assert.doesNotMatch(editorial, /Vinagrete ou Salada/)
  assert.doesNotMatch(editorial, /const .*=\s*\[\s*'Vinagrete'/)
})

test('FAROFA_NOT_DUPLICATED_IN_PLUS_DISPLAY', () => {
  assert.match(rules, /export const SIDES_ITEMS/)
  const sidesBlock = rules.slice(
    rules.indexOf('export const SIDES_ITEMS'),
    rules.indexOf('export const SIDES_ITEMS') + 220,
  )
  assert.match(sidesBlock, /'Farofa'/)
  assert.match(quoteDisplay, /isCommonPackageItem/)
  assert.match(editorial, /PACKAGE_COMMON_ITEMS/)
})

test('SIDES_PRICE_UNCHANGED', () => {
  assert.match(rules, /export const SIDES_PRICE_PER_PERSON = 13/)
  assert.doesNotMatch(editorial, /\b13\b/)
  assert.doesNotMatch(editorial, /\$13/)
})

test('PACKAGE_PRICING_UNCHANGED', () => {
  assert.match(rules, /SIDES_PRICE_PER_PERSON = 13/)
  for (const [key, price] of [
    ['BBQTRAD', 45],
    ['BBQSEL', 55],
    ['BBQCHO', 65],
    ['BBQPRI', 75],
    ['BBQTRAD\\+', 58],
    ['BBQSEL\\+', 68],
    ['BBQCHO\\+', 78],
    ['BBQPRI\\+', 88],
  ]) {
    assert.match(
      rules,
      new RegExp(`package_key: '${key}'[\\s\\S]{0,600}?price_per_person: ${price}\\b`),
      `${key} must still price at ${price}`,
    )
  }
  assert.match(catalog, /data-package-price-breakdown/)
  assert.match(catalog, /data-package-display-total/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
