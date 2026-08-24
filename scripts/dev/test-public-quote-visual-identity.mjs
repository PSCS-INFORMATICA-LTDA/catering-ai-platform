/**
 * Visual identity lock: PACOTES CDL and EXTRAS SUGERIDOS share one family,
 * suggested-extras title is the red/white stamp, and the plus-PT flyer
 * no longer carries the leftover black plate.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-visual-identity.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const json = (p) => JSON.parse(read(p))

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

const css = read('app/globals.css')
const extras = read('components/quotes/additionals/AdditionalCategorySection.tsx')
const editorial = read('components/quotes/PackageSidesEditorial.tsx')
const catalog = read('components/quotes/PublicPackageCatalog.tsx')
const visual = read('Lib/packageCatalogVisual.ts')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const translations = read('Lib/quoteTranslations.ts')
const review = read('components/quote-review/PublicQuoteConfirmationStep.tsx')

test('EXTRAS_SUGERIDOS_TITLE_RED_BG', () => {
  const band = css.match(/\.public-suggested-extras-title-band \{[\s\S]*?\n\}/)?.[0]
  assert.ok(band, 'title band missing')
  assert.match(band, /background: #e21b1b/)
  assert.match(extras, /data-suggested-extras-title-band/)
})

test('EXTRAS_SUGERIDOS_TITLE_WHITE_TEXT', () => {
  const title = css.match(/\.public-suggested-extras-title \{[\s\S]*?\n\}/)?.[0]
  assert.ok(title)
  assert.match(title, /color: #fff/)
  assert.match(extras, /className="public-suggested-extras-title"/)
})

test('EXTRAS_SUGERIDOS_BODY_DARK_PREMIUM', () => {
  const header = css.match(/\.public-suggested-extras-header \{[\s\S]*?\n\}/)?.[0]
  assert.ok(header)
  assert.match(header, /#070707/)
  assert.match(css, /\.public-additional-category\.is-featured \{[\s\S]*?#070707/)
  assert.doesNotMatch(header, /#c8102e|#e21b1b/)
})

test('EXTRAS_SUGERIDOS_YELLOW_HIGHLIGHTS', () => {
  assert.match(css, /\.public-suggested-extras-mark \{[\s\S]*?#f6d000/)
  assert.match(extras, /cortes e extras premium/)
  assert.match(extras, /personalizar seu evento/)
  assert.match(extras, /premium cuts/)
  assert.match(extras, /personalize your event/)
  assert.match(extras, /cortes premium/)
  assert.match(extras, /personalizar tu evento/)
  assert.match(extras, /className="public-suggested-extras-mark"/)
})

test('PACKAGE_AND_EXTRAS_VISUAL_FAMILY_MATCH', () => {
  const stamp = css.match(/\.public-package-headline-mark \{[\s\S]*?\n\}/)?.[0]
  const band = css.match(/\.public-suggested-extras-title-band \{[\s\S]*?\n\}/)?.[0]
  assert.ok(stamp && band)
  assert.match(stamp, /background: #e21b1b/)
  assert.match(stamp, /color: #fff/)
  assert.match(band, /background: #e21b1b/)
  assert.match(band, /color: #fff/)
  assert.match(catalog, /public-package-headline-mark/)
  assert.match(css, /--cdl-yellow/)
})

test('PACKAGE_INFO_BLOCKS_POLISHED', () => {
  assert.match(css, /\.public-package-editorial \{[\s\S]*?rgba\(226, 27, 27/)
  assert.match(css, /\.public-package-editorial-title \{[\s\S]*?font-size: 0\.8rem/)
  assert.match(css, /\.public-package-editorial-title::before \{[\s\S]*?--cdl-yellow/)
})

test('PLUS_GUARNICOES_BLOCK_ALIGNED_WITH_VISUAL_SYSTEM', () => {
  assert.match(editorial, /packageSidesUpsellTitle/)
  assert.match(editorial, /public-package-editorial-price/)
  assert.match(css, /\.public-package-editorial-price \{[\s\S]*?#e21b1b/)
  assert.match(translations, /Adicione guarnições por \{price\} por pessoa\./)
})

test('CUSTOM_PACKAGE_IMAGE_BLACK_SQUARE_REMOVED', () => {
  const script = read('scripts/dev/remove-folder-black-square.py')
  assert.match(script, /bbqpers-plus-pt-v3\.webp/)
  assert.doesNotMatch(script, /bbqpers-plus-en-v3/)
  assert.doesNotMatch(script, /bbqpers-pt-v3/)
  const report = json('assets/packages/folder-black-square-removal.json')
  assert.match(String(report['bbqpers-plus-pt-v3.webp'] ?? ''), /^removed/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v3.webp')}')
assert im is not None
b,g,r = cv2.split(im)
roi = im[1306:1532, 204:504]
rb, rg, rr = cv2.split(roi)
red = ((rr.astype(np.int16) - np.maximum(rg, rb).astype(np.int16) > 45) & (rr > 90)).sum()
print(red)
assert red < 400, red
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PACKAGE_IMAGE_CDL_LOGO_VISIBLE', () => {
  const marks = json('assets/packages/folder-badge-locations.json')
  const mark = marks['bbqpers-plus-pt-v2.webp']
  assert.ok(mark?.size > 100)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v3.webp')}')
x,y,s = 40, 1337, 162
cx, cy = x + s//2, y + s//2
sample = im[cy-8:cy+8, cx-8:cx+8]
# official mark centre is a pale disc, not a black smear
assert sample.mean() > 80, sample.mean()
print(sample.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PACKAGE_IMAGE_ART_NOT_DEGRADED', () => {
  assert.match(visual, /bbqpers-plus-pt-v3\.webp/)
  assert.match(visual, /\?v=bbfix2/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v3.webp')}')
assert im.shape == (1536, 1024, 3)
# food / labels live in the upper 2/3 — that region must stay intact
top = im[80:1100]
assert top.std() > 25
print(im.shape, top.std())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('PRICING_UNCHANGED', () => {
  assert.match(read('Lib/cdlCommercialRules.ts'), /export const SIDES_PRICE_PER_PERSON = 13/)
  assert.doesNotMatch(editorial, /\b13\b/)
  assert.doesNotMatch(extras, /sale_price\s*=/)
})

test('SELECTION_LOGIC_UNCHANGED', () => {
  assert.match(wizard, /onChangeQty=\{setAdditionalQty\}/)
  assert.match(wizard, /handlePackageSelect/)
  assert.match(extras, /onChangeQty: \(itemId: string, qty: number\) => void/)
})

test('CATEGORY_LOGIC_UNCHANGED', () => {
  assert.match(wizard, /SUGGESTED_EXTRAS_DISPLAY_KEY/)
  assert.match(wizard, /if \(category === SUGGESTED_EXTRAS_DISPLAY_KEY\) return/)
  assert.doesNotMatch(wizard, /category_key\s*=\s*'SUGGESTED/)
})

test('REVIEW_UNCHANGED', () => {
  assert.match(review, /getReviewAdditionalCategoryLabel|PublicQuoteConfirmationStep/)
  assert.doesNotMatch(css, /\.public-success[\s\S]{0,200}suggested-extras/)
})

test('PROD_UNCHANGED', () => {
  assert.match(read('scripts/dev/upload-cdl-package-folders-v3.mjs'), /yasprgtlqclwsjcshtls/)
  assert.match(read('scripts/dev/upload-cdl-package-folders-v3.mjs'), /BLOCKED: expected the DEV project/)
  assert.doesNotMatch(visual, /vercel\.app/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
