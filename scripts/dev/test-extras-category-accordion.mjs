/**
 * QA focal — Quote Wizard V2 / Extras category accordion (T01–T15).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

const categorySrc = read(
  'components/quotes/additionals/AdditionalCategorySection.tsx',
)
const itemSrc = read('components/quotes/additionals/AdditionalItemCard.tsx')
const wizardSrc = read('app/quotes/new/QuoteWizard.tsx')
const advanceSrc = read('Lib/wizardStepAdvance.ts')
const displaySrc = read('Lib/quoteAdditionalDisplay.ts')
const translationsSrc = read('Lib/quoteTranslations.ts')

let failed = 0
function check(name, assertion) {
  try {
    assertion()
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error?.message ?? error}`)
  }
}

check('T01 closed category renders category name', () => {
  assert.match(categorySrc, /\{categoryLabel\}/)
})

check('T02 closed category renders localized item count', () => {
  assert.match(categorySrc, /t\.itemsCount\(items\.length\)/)
})

check('T03 expanded category reveals localized item names and prices', () => {
  assert.match(categorySrc, /<AdditionalItemCard/)
  assert.match(itemSrc, /getLocalizedAdditionalLabel\(item, language\)/)
  assert.match(itemSrc, /getAdditionalPriceLabel/)
})

check('T04 categories start collapsed and expand below their header', () => {
  assert.match(wizardSrc, /useState<\s*Set<string>\s*>\(\(\) => new Set\(\)\)/)
  assert.doesNotMatch(wizardSrc, /new Set\(\[additionalCategoryKeys\[0\]/)
  assert.match(categorySrc, /aria-expanded=\{isExpanded\}/)
  assert.match(categorySrc, /\{isExpanded \? \(/)
  assert.match(categorySrc, /IntersectionObserver/)
  assert.match(categorySrc, /data-additional-category-sentinel/)
})

check('T03b collapsed category summarizes every item with price and unit', () => {
  assert.match(categorySrc, /data-additional-category-summary/)
  assert.match(categorySrc, /data-additional-summary-item/)
  assert.match(categorySrc, /items\.map\(\(item\) => \{/)
  assert.match(categorySrc, /getAdditionalPriceLabel\(item, language\)/)
  assert.match(categorySrc, /getAdditionalChargeUnitLabel\(item, language\)/)
  assert.doesNotMatch(categorySrc, /slice\(0,\s*\d/)
})

check('T04b nothing expands without an explicit customer action', () => {
  assert.doesNotMatch(categorySrc, /shouldAutoOpenAdditionalCategory/)
  assert.doesNotMatch(categorySrc, /onEnterReadingZone/)
  assert.doesNotMatch(wizardSrc, /handleAdditionalCategoryReadingZone/)
  assert.match(categorySrc, /onClick=\{onToggle\}/)
})

check('T04c suggested extras stay open and cannot collapse', () => {
  assert.match(categorySrc, /const lockExpanded = featured/)
  assert.match(categorySrc, /data-suggested-extras-locked="true"/)
  assert.match(
    wizardSrc,
    /if \(category === SUGGESTED_EXTRAS_DISPLAY_KEY\) return/,
  )
})

check('T05 expanded category renders lazy item images', () => {
  assert.match(categorySrc, /<AdditionalItemCard/)
  assert.match(itemSrc, /getAdditionalImage\(item\)/)
  assert.match(itemSrc, /loading="lazy"/)
})

check('T06 item selection and quantity callbacks remain wired', () => {
  assert.match(itemSrc, /onChangeQty\(isSelected \? 0 : 1\)/)
  assert.match(itemSrc, /onChangeQty\(normalizedQty - 1\)/)
  assert.match(itemSrc, /onChangeQty\(normalizedQty \+ 1\)/)
  assert.match(wizardSrc, /onChangeQty=\{setAdditionalQty\}/)
})

check('T07 category rendering keeps deterministic vertical order', () => {
  assert.match(displaySrc, /compareCategoryKeys\(a, b\)/)
  assert.match(wizardSrc, /additionalItemsByCategory\.map/)
  assert.match(wizardSrc, /<div className="space-y-4">/)
})

check('T08 mobile layout has one column and no horizontal squeeze', () => {
  assert.match(
    categorySrc,
    /grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4/,
  )
  assert.match(categorySrc, /overflow-hidden rounded-2xl/)
  assert.match(itemSrc, /grid-cols-\[7\.5rem_minmax\(0,1fr\)\]/)
})

check('T09 Next is enabled without reviewing every category', () => {
  assert.match(wizardSrc, /const additionalsStepNextDisabled = false/)
  assert.match(
    advanceSrc,
    /export function canAdvanceFromAdditionalsStep[\s\S]*?return true/,
  )
})

check('T10 Next stays enabled with selected extras', () => {
  assert.match(wizardSrc, /state\.additionals/)
  assert.match(wizardSrc, /resolveNextWizardStep/)
  assert.match(
    advanceSrc,
    /case 4:\s*return canAdvanceFromAdditionalsStep/,
  )
})

check('T11 Next continues to the following wizard step', () => {
  assert.match(advanceSrc, /return ctx\.step \+ 1/)
  assert.match(wizardSrc, /setStep\(nextStep\)/)
})

check('T12 English labels remain driven by i18n', () => {
  assert.match(translationsSrc, /count === 1 \? 'item' : 'items'/)
  assert.match(categorySrc, /getQuoteStrings\(language\)/)
})

check('T13 Portuguese and Spanish labels remain driven by i18n', () => {
  assert.match(translationsSrc, /count === 1 \? 'item' : 'itens'/)
  assert.match(translationsSrc, /count === 1 \? 'artículo' : 'artículos'/)
  assert.match(categorySrc, /language=\{language\}/)
})

check('T14 expanded item cards keep min-width constraints', () => {
  assert.match(itemSrc, /minmax\(0,1fr\)/)
  assert.match(categorySrc, /overflow-hidden rounded-2xl/)
})

check('T15 items without an image keep a stable fallback', () => {
  assert.match(itemSrc, /!image/)
  assert.match(itemSrc, /showPending \? t\.photoPending : label/)
  assert.match(itemSrc, /bg-neutral-100/)
})

if (failed > 0) {
  console.error(`\n${failed} extras accordion test(s) failed.`)
  process.exit(1)
}

console.log('\nAll Extras accordion tests passed.')
