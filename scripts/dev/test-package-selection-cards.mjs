import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const cardSource = readFileSync(
  join(ROOT, 'components/quotes/QuotePackageStepExplorer.tsx'),
  'utf8',
)
const translationsSource = readFileSync(
  join(ROOT, 'Lib/quoteTranslations.ts'),
  'utf8',
)

function check(name, assertion) {
  assertion()
  console.log(`PASS  ${name}`)
}

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
assert.ok(env.service, 'SUPABASE_SERVICE_ROLE_KEY DEV ausente')

const db = createClient(env.url, env.service, {
  auth: { persistSession: false },
})

const packageKeys = [
  'BBQPRI+',
  'BBQCHO+',
  'BBQSEL+',
  'BBQTRAD+',
  'BBQPERS+',
  'BBQPRI',
]

const { data: packages, error: packagesError } = await db
  .from('packages')
  .select(
    'id, package_key, package_highlights_pt, package_highlights_en, package_highlights_es',
  )
  .in('package_key', packageKeys)
  .eq('active', true)

assert.ifError(packagesError)
assert.equal(packages?.length, packageKeys.length)

const packageIds = packages.map((pkg) => pkg.id)
const { data: sideItems, error: sideItemsError } = await db
  .from('package_side_items')
  .select(
    'package_id, label_pt, label_en, label_es, included, active, display_order',
  )
  .in('package_id', packageIds)
  .eq('active', true)
  .order('display_order', { ascending: true })

assert.ifError(sideItemsError)

const packageByKey = new Map(packages.map((pkg) => [pkg.package_key, pkg]))
const sidesByPackageId = new Map()
for (const side of sideItems ?? []) {
  if (side.included === false) continue
  const current = sidesByPackageId.get(side.package_id) ?? []
  current.push(side)
  sidesByPackageId.set(side.package_id, current)
}

for (const [index, packageKey] of packageKeys.slice(0, 5).entries()) {
  check(`T0${index + 1} ${packageKey} renders highlights and included sides`, () => {
    const pkg = packageByKey.get(packageKey)
    assert.ok(pkg)
    assert.ok(pkg.package_highlights_pt?.trim())
    assert.ok((sidesByPackageId.get(pkg.id) ?? []).length > 0)
  })
}

check('T06 package without sides hides the sides block', () => {
  const pkg = packageByKey.get('BBQPRI')
  assert.ok(pkg?.package_highlights_pt?.trim())
  assert.equal((sidesByPackageId.get(pkg.id) ?? []).length, 0)
  assert.match(cardSource, /\{sides\.length > 0 \? \(/)
})

check('T07 card selection remains wired to onSelect', () => {
  assert.match(cardSource, /onClick=\{\(\) => onSelect\(pkg\.id\)\}/)
  assert.match(cardSource, /aria-pressed=\{active\}/)
})

check('T08 mobile card has no image or horizontal overflow', () => {
  assert.doesNotMatch(cardSource, /getPackageCatalogImage/)
  assert.doesNotMatch(cardSource, /<img/)
  assert.match(
    cardSource,
    /grid-cols-\[minmax\(0,2fr\)_minmax\(0,3fr\)\]/,
  )
  assert.match(cardSource, /min-w-0/)
  assert.match(cardSource, /break-words/)
})

check('T09 desktop keeps the balanced two-area card', () => {
  assert.match(cardSource, /sm:gap-4/)
  assert.match(cardSource, /sm:p-4/)
  assert.match(cardSource, /border-l border-cdl-border/)
})

check('T10 Portuguese labels are present', () => {
  assert.match(translationsSource, /highlights: 'Destaques'/)
  assert.match(translationsSource, /garnish: 'Guarnições'/)
})

check('T11 English labels and side item payload are present', () => {
  assert.match(translationsSource, /highlights: 'Highlights'/)
  assert.match(translationsSource, /garnish: 'Sides'/)
  const sides = [...sidesByPackageId.values()].flat()
  assert.ok(sides.every((side) => side.label_en?.trim()))
})

check('T12 Spanish labels and side item payload are present', () => {
  assert.match(translationsSource, /highlights: 'Destacados'/)
  assert.match(translationsSource, /garnish: 'Guarniciones'/)
  const sides = [...sidesByPackageId.values()].flat()
  assert.ok(sides.every((side) => side.label_es?.trim()))
})

check('Package cards reuse the single batch payload (no N+1)', () => {
  assert.match(cardSource, /getPackageSideItemsForPackage/)
  assert.doesNotMatch(cardSource, /\.from\(['"]package_side_items['"]\)/)
})

console.log('PACKAGE-SELECTION-CARDS: PASS')
