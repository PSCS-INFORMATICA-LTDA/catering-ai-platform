/**
 * Mandioca → Maionese on PLUS / COM GUARNIÇÕES only.
 *
 * Copy comes from SIDES_ITEMS + i18n. Arts are the v9 plus folders.
 * Price and business rules stay frozen.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-plus-maionese-v9.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

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

const rules = read('Lib/cdlCommercialRules.ts')
const i18n = read('Lib/cdlPackageItemI18n.ts')
const visual = read('Lib/packageCatalogVisual.ts')
const display = read('Lib/packageDisplay.ts')
const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
const editorial = read('components/quotes/PackageSidesEditorial.tsx')
const quoteDisplay = read('Lib/packageQuoteDisplay.ts')
const script = read('scripts/dev/add-maionese-to-plus-folders-v9.py')

const PLUS_V9 = [
  'bbqtrad-plus-pt-v9.webp',
  'bbqtrad-plus-en-v9.webp',
  'bbqtrad-plus-es-v9.webp',
  'bbqsel-plus-pt-v9.webp',
  'bbqsel-plus-en-v9.webp',
  'bbqsel-plus-es-v9.webp',
  'bbqcho-plus-pt-v9.webp',
  'bbqcho-plus-en-v9.webp',
  'bbqcho-plus-es-v9.webp',
  'bbqpri-plus-pt-v9.webp',
  'bbqpri-plus-en-v9.webp',
  'bbqpri-plus-es-v9.webp',
  'bbqpers-plus-pt-v9.webp',
  'bbqpers-plus-en-v9.webp',
  'bbqpers-plus-es-v9.webp',
]

test('TEXT_MANDIOCA_REMOVED_PT', () => {
  const sides = rules.slice(
    rules.indexOf('export const SIDES_ITEMS'),
    rules.indexOf('export const SIDES_ITEMS') + 220,
  )
  assert.doesNotMatch(sides, /Mandioca/)
  assert.doesNotMatch(display, /Mandioca/)
  assert.doesNotMatch(visual, /mandioca/i)
  assert.match(editorial, /getPlusGuarnicoesFixedSideLabels/)
})

test('TEXT_MAIONESE_ADDED_PT', () => {
  assert.match(rules, /'Maionese'/)
  assert.match(display, /Maionese/)
  assert.match(visual, /farofa e maionese/)
  assert.match(quoteDisplay, /SIDES_ITEMS/)
})

test('TEXT_MANDIOCA_REMOVED_EN', () => {
  assert.doesNotMatch(visual, /cassava/i)
  assert.doesNotMatch(read('Lib/packageQuoteDisplay.ts'), /Cassava/)
  const sides = rules.slice(
    rules.indexOf('export const SIDES_ITEMS'),
    rules.indexOf('export const SIDES_ITEMS') + 220,
  )
  assert.doesNotMatch(sides, /Mandioca/)
})

test('TEXT_MAIONESE_ADDED_EN', () => {
  assert.match(i18n, /Maionese: \{ en: 'Potato salad', es: 'Ensalada de papa' \}/)
  assert.match(visual, /farofa and potato salad/)
})

test('TEXT_MANDIOCA_REMOVED_ES', () => {
  assert.doesNotMatch(visual, /\byuca\b/i)
  const sides = rules.slice(
    rules.indexOf('export const SIDES_ITEMS'),
    rules.indexOf('export const SIDES_ITEMS') + 220,
  )
  assert.doesNotMatch(sides, /Mandioca/)
})

test('TEXT_MAIONESE_ADDED_ES', () => {
  assert.match(i18n, /es: 'Ensalada de papa'/)
  assert.match(visual, /farofa y ensalada de papa/)
})

test('WITH_SIDES_IMAGES_UPDATED', () => {
  for (const file of PLUS_V9) {
    assert.ok(
      existsSync(join(ROOT, 'assets/packages/folders-v3', file)),
      `missing ${file}`,
    )
    assert.match(generated, new RegExp(file.replace('.', '\\.')))
  }
  assert.match(visual, /\?v=art9/)
  assert.match(script, /item-076-clean\.webp/)
  assert.match(script, /'pt': 'Maionese'/)
  assert.match(script, /'en': 'Potato salad'/)
  assert.match(script, /'es': 'Ensalada de papa'/)
})

test('BRAZILIAN_MAYONNAISE_PRESENT_IN_WITH_SIDES_ARTS', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np, os
root = '${join(ROOT, 'assets/packages/folders-v3')}'
files = ${JSON.stringify(PLUS_V9)}
for name in files:
    im = cv2.imread(os.path.join(root, name))
    assert im is not None and im.shape == (1536, 1024, 3), name
    roi = im[1088:1288, 700:990]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    cream = (s < 90) & (v > 130)
    orange = (h >= 8) & (h <= 28) & (s >= 60) & (v >= 70)
    assert cream.mean() > 0.05, (name, 'cream', float(cream.mean()))
    assert orange.mean() > 0.003, (name, 'orange', float(orange.mean()))
print('mayo-ok', len(files))
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('PACKAGE_ART_IDENTITY_PRESERVED', () => {
  for (const key of ['BBQTRAD+', 'BBQSEL+', 'BBQCHO+', 'BBQPRI+', 'BBQPERS+']) {
    assert.match(generated, new RegExp(`"${key.replace('+', '\\+')}"`))
  }
  assert.match(script, /Existing plus folders stay the identity/)
  assert.doesNotMatch(script, /GenerateImage|openai|dall.?e/)
})

test('CDL_LOGO_STILL_CLEAN', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v9.webp')}')
cx, cy, r = 106, 1436, 88
yy, xx = np.ogrid[:im.shape[0], :im.shape[1]]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
ring = (dist > r + 3) & (dist < r + 14)
far = (dist > r + 28) & (dist < r + 52) & (xx > 200)
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
assert gray[ring].mean() + 8 >= gray[far].mean(), (gray[ring].mean(), gray[far].mean())
pale = im[cy-50:cy-22, cx-14:cx+14]
assert pale.mean() > 140, pale.mean()
print(gray[ring].mean(), gray[far].mean(), pale.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
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
      `${key} ${price}`,
    )
  }
  assert.match(script, /'pricing_changed': False/)
})

test('PRICING_ENGINE_UNCHANGED', () => {
  const engine = read('Lib/supabaseCommercialRules.ts')
  assert.match(engine, /sidesPricePerPerson: SIDES_PRICE_PER_PERSON/)
  assert.doesNotMatch(script, /SIDES_PRICE_PER_PERSON/)
})

test('BUSINESS_LOGIC_UNCHANGED', () => {
  assert.match(rules, /MILEAGE_FREE_LIMIT = 20/)
  assert.match(rules, /CHILD_FREE_AGE_MAX = 3/)
  assert.match(rules, /RESERVATION_PERCENTAGE = 30/)
  assert.match(rules, /MIN_ORDER_WEEKDAY = 800/)
  assert.match(editorial, /sidesPricePerPerson/)
  assert.match(quoteDisplay, /isExcludedInclusiveSide/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
