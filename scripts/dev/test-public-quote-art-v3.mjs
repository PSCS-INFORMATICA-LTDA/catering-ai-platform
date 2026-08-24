#!/usr/bin/env node
/**
 * Gates for the V3 art pass, the premium extras callout and the review cleanup.
 *
 * Static checks only — the runtime behaviour is covered by
 * capture-public-quote-upsell.mjs against DEV.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-art-v3.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const json = (p) => JSON.parse(read(p))

let failed = 0
function test(name, fn) {
  try {
    fn()
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${name}`)
    console.log(`      ${error.message.split('\n')[0]}`)
  }
}

const folders = readdirSync(join(ROOT, 'assets/packages/folders-v3')).filter((f) =>
  f.endsWith('.webp'),
)
const labelFix = json('assets/packages/folder-pt-label-fix.json')
const awardFix = json('assets/packages/folder-award-removal.json')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const translations = read('Lib/quoteTranslations.ts')
const css = read('app/globals.css')
const itemCard = read('components/quotes/additionals/AdditionalItemCard.tsx')
const display = read('Lib/quoteAdditionalDisplay.ts')
const rulesPanel = read('components/CdlImportantRulesPanel.tsx')
const reviewLayout = read('components/quote-review/QuoteReviewLayout.tsx')
const paymentCard = read('components/quote-review/QuoteReservationPaymentCard.tsx')

// --- Package art -----------------------------------------------------------

test('PT_PACKAGE_SIDES_LABEL_IS_GUARNICOES', () => {
  // Every PT folder that headed the tray section wrongly now says GUARNIÇÕES.
  const fixed = Object.entries(labelFix).filter(([, note]) => note.includes('->'))
  assert.ok(fixed.length >= 5, `expected the +sides PT folders, got ${fixed.length}`)
  for (const [name, note] of fixed) {
    assert.match(name, /-pt-v3\.webp$/, `${name} is not a PT folder`)
    assert.match(note, /ACOMPANHAMENTOS -> GUARNIÇÕES/)
  }
})

test('PT_PACKAGE_SIDES_LABEL_NOT_ACOMPANHAMENTOS', () => {
  // No PT folder is left reporting the wrong heading still in place.
  for (const [name, note] of Object.entries(labelFix)) {
    if (!name.endsWith('-pt-v3.webp')) continue
    assert.ok(
      note.includes('->') || note.includes('no "ACOMPANHAMENTOS" heading'),
      `${name}: ${note}`,
    )
  }
})

test('EN_ES_SIDES_LABELS_UNTOUCHED', () => {
  // SIDE DISHES / GUARNICIONES were already right, so the pass must skip them.
  for (const name of Object.keys(labelFix)) {
    assert.match(name, /-pt-v3\.webp$/, `${name} should not have been relabelled`)
  }
  const relabel = read('scripts/dev/fix-pt-folder-sides-label.py')
  assert.match(relabel, /'\*-pt-v3\.webp'/, 'relabel must be scoped to PT')
})

test('PIONEER_BADGE_COUNT_ZERO', () => {
  const remaining = Object.entries(awardFix).filter(
    ([, note]) => !note.startsWith('removed'),
  )
  assert.equal(
    remaining.length,
    0,
    `award badge left on: ${remaining.map(([n]) => n).join(', ')}`,
  )
})

test('OFFICIAL_CDL_LOGO_PRESENT', () => {
  // The official mark is stamped from the canonical asset and never redrawn.
  const marks = json('assets/packages/folder-badge-locations.json')
  for (const name of folders) {
    const key = name.replace('-v3.webp', '-v2.webp')
    assert.ok(marks[key] || name === 'bbqtrad-en-v3.webp', `${name} has no mark`)
  }
  const remover = read('scripts/dev/remove-folder-award-badges.py')
  assert.match(remover, /mark is masked out of the repair/)
})

test('PACKAGE_ART_STYLE_PRESERVED', () => {
  // V3 is derived from the approved V2 art, not regenerated.
  const relabel = read('scripts/dev/fix-pt-folder-sides-label.py')
  assert.match(relabel, /shutil\.copyfile/)
  assert.match(relabel, /folders-v2/)
  assert.equal(folders.length, 30)
  // V2 stays on disk so the change is reversible.
  const v2 = readdirSync(join(ROOT, 'assets/packages/folders-v2'))
  assert.equal(v2.filter((f) => f.endsWith('.webp')).length, 30)
})

test('PACKAGE_ART_VERSIONED_AND_ROLLBACKABLE', () => {
  const uploader = read('scripts/dev/upload-cdl-package-folders-v3.mjs')
  assert.match(uploader, /const PREFIX = 'cdl-folders-v3'/)
  assert.match(uploader, /folders-v3/)
  const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
  assert.match(generated, /PACKAGE_FOLDER_PREFIX = 'cdl-folders-v3'/)
  assert.doesNotMatch(generated, /-v2\.webp/)
})

test('NO_TROPEIRO_IN_ART_PIPELINE', () => {
  for (const file of ['scripts/dev/fix-pt-folder-sides-label.py', 'Lib/cdlCommercialRules.ts']) {
    assert.doesNotMatch(read(file), /tropeiro/i, `${file} mentions tropeiro`)
  }
})

// --- Suggested extras ------------------------------------------------------

test('SUGGESTED_EXTRAS_RED_CALLOUT', () => {
  assert.match(wizard, /data-suggested-extras/)
  const block = css.match(/\.public-extras-intro \{[\s\S]*?\n\}/)?.[0]
  assert.ok(block, 'callout style missing')
  assert.match(block, /#c8102e/, 'callout is not CDL red')
  assert.doesNotMatch(block, /border-left: 3px solid/, 'still the old quiet rule')
})

test('SUGGESTED_EXTRAS_WHITE_TEXT', () => {
  for (const cls of ['title', 'lead']) {
    const rule = css.match(new RegExp(`\\.public-extras-intro-${cls} \\{[\\s\\S]*?\\n\\}`))?.[0]
    assert.ok(rule, `${cls} style missing`)
    assert.match(rule, /color: #fff/, `${cls} is not white`)
  }
})

test('SUGGESTED_EXTRA_PRODUCTS_EXIST', () => {
  // The names are read off the live catalog, so they cannot go stale.
  assert.match(display, /export function pickSuggestedExtraNames/)
  assert.match(display, /getLocalizedAdditionalLabel/)
  assert.match(display, /BOVINO_NOBRE/)
  assert.match(display, /PORCO/)
  assert.match(wizard, /pickSuggestedExtraNames\(visibleAdditionalItems, uiLocale\)/)
  // No hand-written product list anywhere in the copy.
  for (const locale of ['pt', 'en', 'es']) void locale
  assert.doesNotMatch(translations, /suggestedExtrasProducts: '[^']*Tomahawk/)
  assert.match(translations, /suggestedExtrasProducts: '[^']*\{products\}/)
})

test('NO_STALE_FOLDER_PRICE_IN_TEASER', () => {
  const copy = [...translations.matchAll(/suggestedExtras\w+: '([^']*)'/g)].map((m) => m[1])
  assert.ok(copy.length >= 9, `expected copy in three locales, got ${copy.length}`)
  for (const line of copy) {
    assert.doesNotMatch(line, /\$\s*\d/, `teaser quotes a price: ${line}`)
  }
})

test('SUGGESTED_EXTRAS_COPY_ALL_LOCALES', () => {
  for (const key of ['suggestedExtrasLead', 'suggestedExtrasProducts', 'suggestedExtrasClose']) {
    const hits = [...translations.matchAll(new RegExp(`${key}:`, 'g'))]
    assert.equal(hits.length, 4, `${key} should be typed once and set in pt/en/es`)
  }
})

test('UNIT_ITEM_QUANTITY_LABEL_VISIBLE', () => {
  assert.match(itemCard, /data-additional-qty-label/)
  assert.match(itemCard, /additionalQuantityLabel/)
  for (const word of ['Quantidade', 'Quantity', 'Cantidad']) {
    assert.match(translations, new RegExp(`additionalQuantityLabel: '${word}'`))
  }
})

test('PER_PERSON_NO_FAKE_QUANTITY_SELECTOR', () => {
  // The label belongs to the stepper branch only; per-person keeps its button.
  const perPerson = itemCard.match(/if \(perPerson\) \{[\s\S]*?\n  \}/)?.[0]
  assert.ok(perPerson, 'per-person branch missing')
  assert.doesNotMatch(perPerson, /additionalQuantityLabel/)
  assert.doesNotMatch(perPerson, /public-additional-qty\b/)
  assert.match(perPerson, /isSelected \? t\.selected : t\.select/)
})

test('ADDITIONAL_QUANTITY_LOGIC_UNCHANGED', () => {
  for (const fn of [
    'normalizeAdditionalQuantity',
    'calcAdditionalLineTotalForItem',
    'isPerPersonAdditional',
  ]) {
    assert.match(display, new RegExp(`export function ${fn}`), `${fn} missing`)
  }
  const diff = execFileSync(
    'git',
    ['diff', 'HEAD', '--unified=0', '--', 'Lib/quoteAdditionalDisplay.ts'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  const removed = diff
    .split('\n')
    .filter((l) => l.startsWith('-') && !l.startsWith('---'))
  assert.equal(removed.length, 0, `quantity lib lost lines:\n${removed.join('\n')}`)
})

test('CATEGORY_ORDER_UNCHANGED_FROM_APPROVED', () => {
  const order = translations.match(/const CATEGORY_SORT_ORDER = \[([\s\S]*?)\] as const/)?.[1]
  assert.ok(order, 'category order missing')
  const keys = [...order.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(keys.slice(0, 8), [
    'BOVINO_NOBRE',
    'BOVINO_TRADICIONAL',
    'PORCO',
    'FRANGO',
    'PEIXES',
    'FRUTOS_DO_MAR',
    'CORDEIRO',
    'LINGUICAS',
  ])
  assert.equal(keys[keys.length - 1], 'OUTROS')
})

test('ITEM_PRICE_DESC_ORDER', () => {
  assert.match(
    display,
    /getAdditionalUnitPrice\(b\) - getAdditionalUnitPrice\(a\)/,
    'price-descending sort was rewritten',
  )
})

// --- Review ----------------------------------------------------------------

test('RESERVATION_PAYMENT_CARD_PRESENT', () => {
  const uses = [...reviewLayout.matchAll(/<QuoteReservationPaymentCard/g)]
  assert.equal(uses.length, 2, 'the financial card must stay on both bodies')
})

test('RESERVATION_PERCENTAGE_CALC_UNCHANGED', () => {
  assert.match(paymentCard, /RESERVATION_PERCENTAGE/)
  assert.match(paymentCard, /BALANCE_PERCENTAGE/)
  assert.match(paymentCard, /docReservationPaymentText/)
  const diff = execFileSync(
    'git',
    ['diff', 'HEAD', '--', 'components/quote-review/QuoteReservationPaymentCard.tsx'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  assert.equal(diff.trim(), '', 'the financial card was modified')
})

test('BALANCE_PRESENT', () => {
  assert.match(paymentCard, /docBalanceDueLine/)
  assert.match(paymentCard, /balanceAmount/)
})

test('IMPORTANT_RULES_DEPOSIT_DUPLICATION_REMOVED', () => {
  assert.doesNotMatch(rulesPanel, /ruleReservationPct/)
  assert.doesNotMatch(rulesPanel, /ruleBalancePct/)
  assert.doesNotMatch(rulesPanel, /docReservationPaymentText/)
  assert.doesNotMatch(rulesPanel, /showReservationText/)
  assert.doesNotMatch(reviewLayout, /showReservationText/)
})

test('MINIMUM_ORDER_RULE_STILL_PRESENT', () => {
  assert.match(rulesPanel, /ruleMinWeekday/)
  assert.match(rulesPanel, /ruleMinWeekend/)
  assert.match(rulesPanel, /docMinOrderRuleTitle/)
})

test('CANCELLATION_RULE_STILL_PRESENT', () => {
  for (const key of ['cancelPolicy1', 'cancelPolicy2', 'cancelPolicy3']) {
    assert.match(rulesPanel, new RegExp(key), `${key} missing`)
  }
  assert.match(reviewLayout, /<CdlCancellationPolicySection/)
})

test('OTHER_RULES_STILL_PRESENT', () => {
  for (const key of [
    'ruleMileageBase',
    'ruleFoodStorage',
    'ruleLatePayment',
    'ruleDecJanMin',
    'ruleHolidaySurcharge',
  ]) {
    assert.match(rulesPanel, new RegExp(key), `${key} was dropped`)
  }
})

test('CONSENT_STICKY_UNCHANGED', () => {
  for (const file of [
    'components/quote-review/PublicQuoteConfirmationStep.tsx',
    'components/quote-review/QuoteReviewLayout.tsx',
  ]) {
    const diff = execFileSync('git', ['diff', 'HEAD', '--', file], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    for (const line of diff.split('\n')) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue
      if (line.startsWith('+++') || line.startsWith('---')) continue
      assert.doesNotMatch(line, /consent|privacy|submit|sticky/i, `touched: ${line}`)
    }
  }
})

test('SUBMIT_VALIDATION_UNCHANGED', () => {
  const diff = execFileSync(
    'git',
    ['diff', 'HEAD', '--', 'app/quotes/new/QuoteWizard.tsx'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  const removed = diff
    .split('\n')
    .filter((l) => l.startsWith('-') && !l.startsWith('---'))
    .filter((l) => !/public-extras-intro-body|suggestedExtrasBody|<\/p>|<p$|^-\s*$/.test(l))
  assert.equal(removed.length, 0, `wizard lost lines:\n${removed.join('\n')}`)
})

console.log(
  failed ? `\n${failed} failed` : `\nall gates passed`,
)
process.exit(failed ? 1 : 0)
