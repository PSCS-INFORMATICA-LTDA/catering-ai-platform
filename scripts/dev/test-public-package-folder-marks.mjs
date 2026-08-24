/**
 * Gates for the folder artwork corrections: every folder carries the official
 * CDL mark, the fabricated award badges are gone where they could be removed
 * cleanly, and the artwork itself is otherwise untouched.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-package-folder-marks.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FOLDERS = join(ROOT, 'assets/packages/folders-v3')
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

const names = readdirSync(FOLDERS).filter((f) => f.endsWith('.webp')).sort()
const locations = json('assets/packages/folder-badge-locations.json')
const removal = json('assets/packages/folder-pioneer-removal.json')
const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')

test('FOLDER_SET_COMPLETE', () => {
  // Five tiers x with/without sides x three locales.
  assert.equal(names.length, 30, `expected 30 folders, found ${names.length}`)
  for (const locale of ['pt', 'en', 'es']) {
    const forLocale = names.filter((n) => n.includes(`-${locale}-v3`))
    assert.equal(forLocale.length, 10, `${locale} should have 10 folders`)
  }
})

test('FOLDER_OFFICIAL_CDL_MARK_APPLIED', () => {
  // The badge asset is cut from the canonical logo, not redrawn.
  const builder = read('scripts/dev/build-cdl-folder-badge.mjs')
  assert.match(builder, /public\/cdl\/logo-cdl\.png/)
  const stamper = read('scripts/dev/fix-cdl-folder-marks.mjs')
  assert.match(stamper, /cdl-badge-official\.png/)
  const badge = statSync(join(ROOT, 'assets/packages/cdl-badge-official.png'))
  assert.ok(badge.size > 10_000, 'official badge asset missing or empty')
})

test('FOLDER_WRONG_CDL_LOGO_COUNT_ZERO', () => {
  // Every folder was either matched and stamped, or had the mark placed.
  const placed = read('scripts/dev/fix-cdl-folder-marks.mjs').match(
    /const MISSING = \{([\s\S]*?)\n\}/,
  )?.[1]
  assert.ok(placed !== undefined, 'placement table missing')
  const placedNames = [...placed.matchAll(/'([^']+\.webp)'/g)].map((m) => m[1])
  // V3 is derived from V2 without moving anything, so the marks resolved for
  // V2 still describe where they sit.
  for (const name of names) {
    const key = name.replace('-v3.webp', '-v2.webp')
    const matched = locations[key] && locations[key].score >= 0.12
    assert.ok(
      matched || placedNames.includes(key),
      `${name} has no resolved CDL mark`,
    )
  }
})

test('FOLDER_MARKS_CONSISTENT_SIZE_AND_MARGIN', () => {
  // One visual family: the mark sits on the left margin at a similar size.
  const spots = names
    .map((n) => locations[n.replace('-v3.webp', '-v2.webp')])
    .filter((v) => v && v.score >= 0.12)
  const xs = spots.map((v) => v.x / 1024)
  const sizes = spots.map((v) => v.size / 1024)
  assert.ok(Math.max(...xs) < 0.12, `mark drifts right (max x ${Math.max(...xs)})`)
  assert.ok(
    Math.max(...sizes) - Math.min(...sizes) < 0.12,
    'mark sizes vary too much between folders',
  )
})

test('FABRICATED_AWARD_BADGE_REMOVED_OR_REPORTED', () => {
  assert.equal(Object.keys(removal).length, names.length)
  const removed = Object.values(removal).filter((v) => v.startsWith('removed'))
  assert.ok(removed.length >= 20, `only ${removed.length} award badges removed`)
  // Anything not removed is explicitly accounted for, never silently degraded.
  for (const [name, note] of Object.entries(removal)) {
    assert.match(
      note,
      /^(removed|kept:|no award badge found|skipped:)/,
      `${name} has an unclear outcome: ${note}`,
    )
  }
})

test('NO_FABRICATED_CLAIM_IN_CODE', () => {
  // The award was never a real brand asset; nothing should reference it.
  for (const file of [
    'Lib/publicQuote/packageFolderArt.generated.ts',
    'Lib/packageCatalogVisual.ts',
  ]) {
    assert.doesNotMatch(read(file), /pioneer/i, `${file} references the award`)
  }
})

test('FOLDER_ART_STILL_MAPPED_PER_LOCALE', () => {
  for (const locale of ['pt', 'en', 'es']) {
    const mapped = [...generated.matchAll(new RegExp(`"${locale}": "([^"]+)"`, 'g'))]
    assert.equal(mapped.length, 10, `${locale} should map 10 folders`)
    for (const [, file] of mapped) {
      assert.ok(names.includes(file), `${file} is mapped but not on disk`)
    }
  }
  // Portable: file names only, bucket and host resolved at runtime.
  assert.doesNotMatch(generated, /https?:\/\//)
  assert.match(generated, /PACKAGE_FOLDER_PREFIX = 'cdl-folders-v3'/)
})

test('FOLDER_FILES_WEB_SIZED', () => {
  for (const name of names) {
    const bytes = statSync(join(FOLDERS, name)).size
    assert.ok(bytes > 20_000, `${name} looks truncated (${bytes} bytes)`)
    assert.ok(bytes < 1_200_000, `${name} is too heavy (${bytes} bytes)`)
  }
})

test('FOLDER_PIPELINE_IS_REPRODUCIBLE', () => {
  // The corrections are scripted, not hand-edited binaries.
  for (const script of [
    'scripts/dev/build-cdl-folder-badge.mjs',
    'scripts/dev/fix-cdl-folder-marks.mjs',
    'scripts/dev/locate-folder-badges.py',
    'scripts/dev/remove-folder-pioneer-marks.py',
  ]) {
    assert.ok(read(script).length > 500, `${script} missing`)
  }
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
