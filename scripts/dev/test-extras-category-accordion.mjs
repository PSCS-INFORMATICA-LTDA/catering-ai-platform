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

check('T03 closed category previews localized item names', () => {
  assert.match(categorySrc, /getLocalizedAdditionalLabel\(item, language\)/)
  assert.match(categorySrc, /\.join\(' • '\)/)
  assert.match(categorySrc, /data-additional-category-preview/)
})

check('T04 categories start collapsed and expand below their header', () => {
  assert.match(wizardSrc, /useState<\s*Set<string>\s*>\(\(\) => new Set\(\)\)/)
  assert.doesNotMatch(wizardSrc, /new Set\(\[additionalCategoryKeys\[0\]/)
  assert.match(categorySrc, /aria-expanded=\{expanded\}/)
  assert.match(categorySrc, /\{expanded \? \(/)
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
  assert.match(itemSrc, /grid-cols-\[5\.75rem_minmax\(0,1fr\)\]/)
})

check('T09 Next stays enabled after opening or closing categories', () => {
  assert.match(wizardSrc, /additionalsStepNextDisabled = false/)
  assert.match(advanceSrc, /canAdvanceFromAdditionalsStep[^]*?return true/)
})

check('T10 Next stays enabled with selected extras', () => {
  assert.match(wizardSrc, /state\.additionals/)
  assert.match(wizardSrc, /resolveNextWizardStep/)
  assert.match(
    advanceSrc,
    /case 3:\s*return canAdvanceFromAdditionalsStep/,
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

check('T14 long category previews are clamped cleanly', () => {
  assert.match(categorySrc, /line-clamp-3/)
  assert.match(categorySrc, /break-words/)
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
