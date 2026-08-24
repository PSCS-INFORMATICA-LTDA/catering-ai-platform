/**
 * Package folder V2 gates.
 *
 * The folders carry text, so there is one per package, variant and locale. These
 * gates lock the mapping, the fallback and the fact that nothing about pricing,
 * selection or the accordion moved with them.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-package-folders-v3.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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

const visual = source('Lib/packageCatalogVisual.ts')
const generated = source('Lib/publicQuote/packageFolderArt.generated.ts')
const catalog = source('components/quotes/PublicPackageCatalog.tsx')
const uploader = source('scripts/dev/upload-cdl-package-folders-v3.mjs')
const masters = readdirSync(join(ROOT, 'assets/packages/folders-v3')).filter((f) =>
  f.endsWith('.webp'),
)

const KEYS = [
  'BBQTRAD',
  'BBQTRAD+',
  'BBQSEL',
  'BBQSEL+',
  'BBQCHO',
  'BBQCHO+',
  'BBQPRI',
  'BBQPRI+',
  'BBQPERS',
  'BBQPERS+',
]
const LOCALES = ['pt', 'en', 'es']

test('FOLDER_SET_COMPLETE', () => {
  // One master per package, variant and locale.
  assert.equal(masters.length, KEYS.length * LOCALES.length)
  for (const key of KEYS) {
    const slug = key.replace('+', '-plus').toLowerCase()
    for (const locale of LOCALES) {
      assert.ok(
        masters.includes(`${slug}-${locale}-v3.webp`),
        `missing master ${slug}-${locale}-v3.webp`,
      )
    }
  }
})

test('PACKAGE_PT_EN_ES_ART_MAPPED', () => {
  for (const key of KEYS) {
    for (const locale of LOCALES) {
      const entry = new RegExp(
        `"${key.replace('+', '\\+')}":[\\s\\S]{0,400}?"${locale}": "[a-z-]+${locale}-v3\\.webp"`,
      )
      assert.match(generated, entry, `${key} ${locale} is not mapped`)
    }
  }
  const files = [...generated.matchAll(/"([a-z-]+-v3\.webp)"/g)].map((m) => m[1])
  assert.equal(files.length, 30)
  // The bucket the runtime already reads from, and no baked-in host.
  assert.match(generated, /PACKAGE_FOLDER_BUCKET = 'package-images'/)
  assert.match(generated, /PACKAGE_FOLDER_PREFIX = 'cdl-folders-v3'/)
  assert.doesNotMatch(generated, /https:\/\//)
})

test('WITH_AND_WITHOUT_SIDES_ART_DISTINCT', () => {
  for (const base of ['BBQTRAD', 'BBQSEL', 'BBQCHO', 'BBQPRI', 'BBQPERS']) {
    for (const locale of LOCALES) {
      const plain = new RegExp(`"${base}":[\\s\\S]{0,400}?"${locale}": "([^"]+)"`)
      const plus = new RegExp(`"${base}\\+":[\\s\\S]{0,400}?"${locale}": "([^"]+)"`)
      const a = generated.match(plain)?.[1]
      const b = generated.match(plus)?.[1]
      assert.ok(a && b, `${base} ${locale} missing`)
      assert.notEqual(a, b, `${base} ${locale} reuses one file for both variants`)
      assert.match(b, /-plus-/)
    }
  }
})

test('CUSTOM_FOLDER_CREATED', () => {
  // BBQPERS is a real active package with no artwork before this change.
  for (const locale of LOCALES) {
    assert.match(generated, new RegExp(`"BBQPERS":[\\s\\S]{0,400}?"${locale}"`))
    assert.match(generated, new RegExp(`"BBQPERS\\+":[\\s\\S]{0,400}?"${locale}"`))
  }
})

test('ART_FOLLOWS_LOCALE_WITH_FALLBACK', () => {
  assert.match(visual, /export function getPackageFolderArt/)
  assert.match(visual, /byLocale\?\.\[locale\] \?\? byLocale\?\.pt/)
  // The database column stays the fallback, so a card can never go blank.
  assert.match(visual, /const direct = pkg\.image_url\?\.trim\(\) \|\| null/)
  assert.match(visual, /findBasePackage\(pkg, allPackages\)/)
  assert.match(catalog, /getPackageCatalogImage\(pkg, allPackages, language\)/)
})

test('NO_SECOND_IMAGE_INFRASTRUCTURE', () => {
  // Same bucket, same storage client, same <img> render path.
  assert.match(uploader, /const BUCKET = .package-images./)
  assert.match(visual, /storage\/v1\/object\/public/)
  assert.match(uploader, /createClient/)
  assert.doesNotMatch(catalog, /\/assets\/packages/)
  const heroArt = source('components/quotes/PackageCatalogHeroArt.tsx')
  assert.match(heroArt, /<img/)
})

test('UPLOADER_IS_DEV_ONLY', () => {
  assert.match(uploader, /const DEV_REF = 'yasprgtlqclwsjcshtls'/)
  assert.match(uploader, /BLOCKED: expected the DEV project/)
})

test('PACKAGE_SELECTION_OPTIONS_AND_SCROLL_UNCHANGED', () => {
  // Only the image argument changed on the card.
  assert.match(catalog, /data-package-selected=\{active \? 'true' : 'false'\}/)
  assert.match(catalog, /onClick=\{onClick\}/)
  assert.match(catalog, /data-package-group-open/)
  const options = source('components/quotes/PackageIncludedOptions.tsx')
  assert.match(options, /revealNextBlockWhenReady/)
  assert.match(options, /onChange\?\.\(group\.id, item\.id\)/)
})

test('CARD_PRICE_UNTOUCHED', () => {
  assert.match(catalog, /data-package-price-breakdown/)
  assert.match(catalog, /data-package-display-total/)
  assert.match(catalog, /getPackagePriceLineLabel\('total', language\)/)
  const rules = source('Lib/cdlCommercialRules.ts')
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
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
