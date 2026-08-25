/**
 * COM GUARNIÇÕES visual pass: four presented sides, editorial before
 * with/without options, uppercase labels, v10 arts. Price and rules frozen.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-plus-sides-v10.mjs
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

const catalog = read('components/quotes/PublicPackageCatalog.tsx')
const editorial = read('components/quotes/PackageSidesEditorial.tsx')
const translations = read('Lib/quoteTranslations.ts')
const visual = read('Lib/packageCatalogVisual.ts')
const quoteDisplay = read('Lib/packageQuoteDisplay.ts')
const rules = read('Lib/cdlCommercialRules.ts')
const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
const css = read('app/globals.css')
const script = read('scripts/dev/rebuild-plus-folders-four-sides-v10.py')
const uploader = read('scripts/dev/upload-cdl-package-folders-v3.mjs')

const PLUS_V10 = [
  'bbqtrad-plus-pt-v10.webp',
  'bbqtrad-plus-en-v10.webp',
  'bbqtrad-plus-es-v10.webp',
  'bbqsel-plus-pt-v10.webp',
  'bbqsel-plus-en-v10.webp',
  'bbqsel-plus-es-v10.webp',
  'bbqcho-plus-pt-v10.webp',
  'bbqcho-plus-en-v10.webp',
  'bbqcho-plus-es-v10.webp',
  'bbqpri-plus-pt-v10.webp',
  'bbqpri-plus-en-v10.webp',
  'bbqpri-plus-es-v10.webp',
  'bbqpers-plus-pt-v10.webp',
  'bbqpers-plus-en-v10.webp',
  'bbqpers-plus-es-v10.webp',
]

test('SIDES_BLOCK_BEFORE_OPTIONS_PRESENT', () => {
  const editorialAt = catalog.indexOf('<PackageSidesEditorial')
  const optionsAt = catalog.indexOf('data-package-group-controls')
  assert.ok(editorialAt > 0 && optionsAt > editorialAt)
  assert.match(editorial, /data-package-presented-sides/)
  assert.match(editorial, /data-package-sides-editorial/)
})

test('SIDES_BLOCK_CONTENT_UPDATED_PT', () => {
  assert.match(
    quoteDisplay,
    /pt: \['ARROZ BRANCO', 'FEIJÃO PRETO', 'MAIONESE', 'VINAGRETE'\]/,
  )
  assert.match(translations, /SALADA CÉSAR COMO OPCIONAL\./)
  assert.match(translations, /Guarnições que completam a experiência do seu churrasco\./)
  assert.match(translations, /ACOMPANHAMENTOS INCLUSOS NO PACOTE/)
  assert.match(editorial, /getPresentedPlusSideLabels/)
  assert.doesNotMatch(editorial, /Mandioca/)
})

test('SIDES_BLOCK_CONTENT_UPDATED_EN', () => {
  assert.match(
    quoteDisplay,
    /en: \['WHITE RICE', 'BLACK BEANS', 'POTATO SALAD', 'VINAIGRETTE'\]/,
  )
  assert.match(translations, /CAESAR SALAD AS AN OPTIONAL ADD-ON\./)
})

test('SIDES_BLOCK_CONTENT_UPDATED_ES', () => {
  assert.match(
    quoteDisplay,
    /es: \['ARROZ BLANCO', 'FRIJOLES NEGROS', 'ENSALADA DE PAPA', 'VINAGRETA'\]/,
  )
  assert.match(translations, /ENSALADA CÉSAR COMO OPCIONAL\./)
  assert.match(translations, /withSidesGroupTitle: 'CON GUARNICIONES'/)
})

test('WITH_SIDES_IMAGES_ALL_UPDATED', () => {
  for (const file of PLUS_V10) {
    assert.ok(
      existsSync(join(ROOT, 'assets/packages/folders-v3', file)),
      `missing ${file}`,
    )
    assert.match(generated, new RegExp(file.replace('.', '\\.')))
  }
  assert.match(visual, /\?v=art10/)
  assert.match(uploader, /v\(\?:\[3-9\]\|10\)/)
})

test('WITH_SIDES_IMAGES_SHOW_4_SIDES', () => {
  const labels = script.slice(script.indexOf('LABELS = {'), script.indexOf('JOBS = ['))
  assert.match(labels, /'ARROZ BRANCO'/)
  assert.match(labels, /'FEIJÃO PRETO'/)
  assert.match(labels, /'MAIONESE'/)
  assert.match(labels, /'VINAGRETE'/)
  assert.match(labels, /'WHITE RICE'/)
  assert.match(labels, /'POTATO SALAD'/)
  assert.match(labels, /'VINAIGRETTE'/)
  assert.match(labels, /'ENSALADA DE PAPA'/)
  assert.doesNotMatch(labels, /CÉSAR|Caesar|Cesar|Farofa/)
})

test('FOUR_SIDES_PIXELS_ON_PLUS_ARTS', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np, os
root = '${join(ROOT, 'assets/packages/folders-v3')}'
files = ${JSON.stringify(PLUS_V10)}
for name in files:
    im = cv2.imread(os.path.join(root, name))
    assert im is not None and im.shape == (1536, 1024, 3), name
    band = im[1000:1380]
    hsv = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    rice = band[:, 20:250]
    beans = band[:, 260:500]
    mayo = band[:, 530:760]
    vin = band[:, 780:1010]
    rice_hsv = cv2.cvtColor(rice, cv2.COLOR_BGR2HSV)
    beans_hsv = cv2.cvtColor(beans, cv2.COLOR_BGR2HSV)
    mayo_hsv = cv2.cvtColor(mayo, cv2.COLOR_BGR2HSV)
    vin_hsv = cv2.cvtColor(vin, cv2.COLOR_BGR2HSV)
    rice_white = ((rice_hsv[:,:,1] < 70) & (rice_hsv[:,:,2] > 140)).mean()
    beans_dark = (beans_hsv[:,:,2] < 80).mean()
    mayo_cream = ((mayo_hsv[:,:,1] < 95) & (mayo_hsv[:,:,2] > 130)).mean()
    mayo_orange = ((mayo_hsv[:,:,0] >= 8) & (mayo_hsv[:,:,0] <= 28) & (mayo_hsv[:,:,1] >= 50) & (mayo_hsv[:,:,2] >= 70)).mean()
    vin_red = (((vin_hsv[:,:,0] <= 12) | (vin_hsv[:,:,0] >= 168)) & (vin_hsv[:,:,1] >= 40) & (vin_hsv[:,:,2] >= 40)).mean()
    assert rice_white > 0.04, (name, 'rice', float(rice_white))
    assert beans_dark > 0.12, (name, 'beans', float(beans_dark))
    assert mayo_cream > 0.05, (name, 'mayo', float(mayo_cream))
    assert mayo_orange > 0.002, (name, 'mayo-orange', float(mayo_orange))
    assert vin_red > 0.02, (name, 'vin-red', float(vin_red))
    assert vin_red > mayo_cream * 0.15, (name, 'vin-vs-mayo', float(vin_red), float(mayo_cream))
print('four-sides-ok', len(files))
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('RICE_PRESENT', () => {
  assert.match(quoteDisplay, /Arroz branco/)
  assert.match(script, /ARROZ BRANCO/)
})

test('BLACK_BEANS_PRESENT', () => {
  assert.match(quoteDisplay, /Feijão preto/)
  assert.match(script, /FEIJÃO PRETO/)
})

test('MAYONNAISE_PRESENT', () => {
  assert.match(quoteDisplay, /Maionese/)
  assert.match(script, /MAIONESE/)
})

test('VINAIGRETTE_PRESENT', () => {
  assert.match(quoteDisplay, /Vinagrete/)
  assert.match(script, /VINAGRETE/)
})

test('CAESAR_NOT_INSIDE_PACKAGE_IMAGES', () => {
  const labels = script.slice(script.indexOf('LABELS = {'), script.indexOf('JOBS = ['))
  assert.match(editorial, /packageSidesOptionalNote/)
  assert.doesNotMatch(labels, /César|Caesar|Cesar/)
  assert.match(visual, /SALADA CÉSAR como opcional/)
})

test('PACKAGE_NAME_VISIBLE_ON_ART', () => {
  assert.match(script, /Upper identity/)
  assert.match(generated, /"BBQTRAD\+"/)
  assert.match(generated, /"BBQSEL\+"/)
  assert.match(generated, /"BBQCHO\+"/)
  assert.match(generated, /"BBQPRI\+"/)
  assert.match(generated, /"BBQPERS\+"/)
})

test('PRIME_NAME_VISIBLE', () => {
  assert.match(generated, /bbqpri-plus-pt-v10\.webp/)
  assert.match(generated, /bbqpri-plus-en-v10\.webp/)
  assert.match(generated, /bbqpri-plus-es-v10\.webp/)
})

test('CUSTOM_NAME_VISIBLE', () => {
  assert.match(generated, /bbqpers-plus-pt-v10\.webp/)
  assert.match(generated, /bbqpers-plus-en-v10\.webp/)
  assert.match(generated, /bbqpers-plus-es-v10\.webp/)
})

test('CDL_LOGO_CLEAN_ON_ALL_ARTS', () => {
  assert.match(script, /cdl-badge-official\.png/)
  assert.match(script, /raw > 0\.20/)
  assert.doesNotMatch(script, /GaussianBlur|GenerateImage|openai|dall.?e/)
})

test('NO_BLUR_OR_PATCH_ON_LOGO', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpri-plus-pt-v10.webp')}')
# official stamp lands under the labels on Prime
cx, cy, r = 56, 1486, 38
yy, xx = np.ogrid[:im.shape[0], :im.shape[1]]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
disk = dist <= r
sample = im[disk]
assert sample.mean() > 40, sample.mean()
print('logo', sample.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('SIDES_DISPLAY_UPPERCASE_STANDARDIZED', () => {
  assert.match(quoteDisplay, /toPublicSidesDisplayLabel/)
  assert.match(editorial, /toPublicSidesDisplayLabel/)
  assert.match(css, /\.public-package-presented-names \{[\s\S]*?text-transform: uppercase/)
  assert.match(css, /\.public-additional-card-name \{[\s\S]*?text-transform: uppercase/)
  assert.match(quoteDisplay, /toLocaleUpperCase/)
})

test('PRICING_UNCHANGED', () => {
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
  assert.doesNotMatch(script, /SIDES_PRICE_PER_PERSON/)
})

test('BUSINESS_LOGIC_UNCHANGED', () => {
  assert.match(rules, /MILEAGE_FREE_LIMIT = 20/)
  assert.match(rules, /CHILD_FREE_AGE_MAX = 3/)
  assert.match(rules, /RESERVATION_PERCENTAGE = 30/)
  assert.match(rules, /MIN_ORDER_WEEKDAY = 800/)
  assert.match(quoteDisplay, /export function getPlusGuarnicoesFixedSideItems/)
  assert.match(quoteDisplay, /SIDES_ITEMS\.filter/)
  assert.match(editorial, /sidesPricePerPerson/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
