/**
 * Package media & presentation gates.
 *
 * The numbers 1–4 and the printed prices live inside the artwork stored in
 * Supabase, not in the card code, so the code-side gates here lock what the card
 * itself must keep doing: no numeric badge of its own, the name carrying the
 * card, and the pricing block untouched.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-package-media.mjs
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

const catalog = source('components/quotes/PublicPackageCatalog.tsx')
const heroArt = source('components/quotes/PackageCatalogHeroArt.tsx')
const visual = source('Lib/packageCatalogVisual.ts')
const rules = source('Lib/cdlCommercialRules.ts')

test('PACKAGE_NUMBERS_NOT_RENDERED_BY_CODE', () => {
  const card = catalog.slice(
    catalog.indexOf('data-package-key={pkg.package_key'),
    catalog.indexOf('data-package-price-breakdown'),
  )
  // No ordinal, index badge or "Package N" anywhere on the card chrome.
  assert.doesNotMatch(card, /index \+ 1/)
  assert.doesNotMatch(card, /data-package-index/)
  assert.doesNotMatch(card, /Pacote \d|Package \d|Paquete \d/)
  // The hero art wrapper renders the image and nothing numeric of its own.
  assert.doesNotMatch(heroArt, /index \+ 1/)
  assert.doesNotMatch(heroArt, /data-package-index/)
  assert.doesNotMatch(heroArt, /\{\s*\d\s*\}/)
})

test('PACKAGE_NAME_PROMINENT', () => {
  assert.match(catalog, /data-package-card-name/)
  const name = catalog.match(
    /data-package-card-name\s*\n\s*className="([^"]+)"/,
  )?.[1]
  assert.ok(name, 'card name needs its own class list')
  // Outranks the price lines, which are text-sm.
  assert.match(name, /text-lg/)
  assert.match(name, /sm:text-xl/)
  assert.match(name, /font-black/)
  // No new palette, no promotional treatment.
  assert.doesNotMatch(name, /shadow|glow|bg-|uppercase|text-\[#/)
})

test('PACKAGE_CARD_PRICE_VISIBLE', () => {
  // All three lines still rendered by the card.
  assert.match(catalog, /data-package-price-breakdown/)
  assert.match(catalog, /getPackagePriceLineLabel\('package', language\)/)
  assert.match(catalog, /getPackagePriceLineLabel\('sides', language\)/)
  assert.match(catalog, /getPackagePriceLineLabel\('total', language\)/)
  assert.match(catalog, /data-package-display-total/)
  assert.match(catalog, /formatPackageCatalogPriceLabel/)
})

test('PACKAGE_CARD_PRICING_LAYOUT_UNCHANGED', () => {
  assert.match(catalog, /className="mt-1 min-w-0 space-y-0\.5 text-sm leading-snug"/)
  assert.match(catalog, /public-package-price-unit/)
  assert.match(
    catalog,
    /text-base font-black tabular-nums text-\[var\(--brand-primary\)\]/,
  )
})

test('PACKAGE_PRICING_VALUES_UNCHANGED', () => {
  // The commercial source of truth is untouched.
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
    const block = new RegExp(
      `package_key: '${key}'[\\s\\S]{0,600}?price_per_person: ${price}\\b`,
    )
    assert.match(rules, block, `${key} must still price at ${price}`)
  }
  // The pricing helpers the card calls are untouched.
  assert.match(visual, /export function getPackageCatalogPrice/)
  assert.match(
    visual,
    /price_per_person[\s\S]{0,120}base_price/,
  )
})

test('PACKAGE_IMAGE_PIPELINE_UNCHANGED', () => {
  // Still one canonical source: packages.image_url, with the base-key fallback.
  assert.match(visual, /export function getPackageCatalogImage/)
  assert.match(visual, /const direct = pkg\.image_url\?\.trim\(\) \|\| null/)
  assert.match(visual, /findBasePackage\(pkg, allPackages\)/)
  // No second image infrastructure was introduced.
  assert.doesNotMatch(catalog, /\/packages\/.*\.(png|webp|jpg)/)
})

test('BLACK_BEANS_IN_SIDES_COPY', () => {
  // The presentation copy already says black beans in all three locales.
  const sides = visual.slice(visual.indexOf('getPackageSidesDescription'))
  assert.match(sides, /feij[ãa]o preto/i)
  assert.match(sides, /black beans/i)
  assert.match(sides, /frijoles negros/i)
  assert.doesNotMatch(sides.slice(0, 900), /tropeiro/i)
})

test('PACKAGE_NAMES_RESOLVE_PER_LOCALE', () => {
  // label_en / label_es exist for every commercial row, so the card name is
  // localised even though the artwork is not.
  assert.match(visual, /export function getPackageCatalogName/)
  for (const field of ['label_en', 'label_es', 'label_pt']) {
    assert.match(visual, new RegExp(`pkg\\.${field}`))
  }
  for (const key of ['BBQTRAD', 'BBQSEL', 'BBQCHO', 'BBQPRI']) {
    const block = new RegExp(`package_key: '${key}'[\\s\\S]{0,600}?label_en:`)
    assert.match(rules, block, `${key} needs an English label`)
  }
})

test('NO_FAKE_PACKAGE_CREATED', () => {
  // Exactly the eight commercial rows; PERS lives in the database only.
  const keys = [...rules.matchAll(/package_key: '(BBQ[A-Z+]+)'/g)].map((m) => m[1])
  assert.deepEqual(
    [...new Set(keys)].sort(),
    ['BBQCHO', 'BBQCHO+', 'BBQPRI', 'BBQPRI+', 'BBQSEL', 'BBQSEL+', 'BBQTRAD', 'BBQTRAD+'],
  )
  // Nothing invented a package or a variant in the presentation layer.
  assert.doesNotMatch(catalog, /BBQ(TRAD|SEL|CHO|PRI|PERS)/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
