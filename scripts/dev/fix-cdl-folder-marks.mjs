/**
 * Stamps the official CDL mark onto every package folder.
 *
 * The folders carry an approximation of the mark — right silhouette, but a dark
 * centre and a mangled grill — and it differs from folder to folder. Rather
 * than redraw anything, this finds the badge by matching the real logo's edge
 * structure and stamps the official asset over it, slightly oversized so no rim
 * of the old mark survives.
 *
 * Everything else in the artwork is untouched.
 *
 * Run: node scripts/dev/fix-cdl-folder-marks.mjs [--check]
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FOLDERS = join(ROOT, 'assets/packages/folders-v2')
const BADGE = join(ROOT, 'assets/packages/cdl-badge-official.png')
const LOCATIONS = join(ROOT, 'assets/packages/folder-badge-locations.json')

// Enough oversize to bury the old rim without changing the composition.
const COVER = 1.18
const CONFIDENT = 0.12

/**
 * Folders that carry no mark at all, so there is nothing to match. The mark is
 * placed on the left margin like every other folder, at a height that clears
 * the artwork. Fractions of the canvas, since these are hand-picked.
 */
const MISSING = {
  'bbqtrad-en-v2.webp': { x: 0.045, y: 0.545, size: 0.182 },
}

const check = process.argv.includes('--check')

const locate = () => {
  const script = join(ROOT, 'scripts/dev/locate-folder-badges.py')
  const out = execFileSync('python3', [script], { encoding: 'utf8', maxBuffer: 1 << 26 })
  return JSON.parse(out)
}

const found = locate()
const names = readdirSync(FOLDERS).filter((f) => f.endsWith('.webp')).sort()

const unresolved = names.filter(
  (n) => !MISSING[n] && (!found[n] || found[n].score < CONFIDENT),
)
if (unresolved.length) {
  console.error(`badge neither matched nor placed for ${unresolved.length} folder(s):`)
  for (const n of unresolved) {
    console.error(`  ${n} ${found[n] ? found[n].score.toFixed(3) : 'none'}`)
  }
  process.exit(1)
}

writeFileSync(LOCATIONS, `${JSON.stringify(found, null, 2)}\n`)

if (check) {
  const scores = names
    .filter((n) => !MISSING[n])
    .map((n) => found[n].score)
  console.log(
    `matched ${scores.length} badges  min ${Math.min(...scores).toFixed(3)}  ` +
      `max ${Math.max(...scores).toFixed(3)}  placed ${Object.keys(MISSING).length}`,
  )
  process.exit(0)
}

const badge = await sharp(BADGE).png().toBuffer()

for (const name of names) {
  const file = join(FOLDERS, name)
  const base = sharp(file)
  const { width, height } = await base.metadata()

  const placement = MISSING[name]
  const spot = placement
    ? {
        x: Math.round(placement.x * width),
        y: Math.round(placement.y * height),
        size: Math.round(placement.size * width),
        score: null,
      }
    : found[name]

  // A placed mark needs no oversize; there is nothing underneath it.
  const size = Math.round(spot.size * (placement ? 1 : COVER))
  const shift = Math.round((size - spot.size) / 2)
  const left = Math.max(0, Math.min(width - size, spot.x - shift))
  const top = Math.max(0, Math.min(height - size, spot.y - shift))

  const stamp = await sharp(badge)
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  const out = await base
    .composite([{ input: stamp, left, top }])
    .webp({ quality: 88, effort: 5 })
    .toBuffer()

  writeFileSync(file, out)
  console.log(
    `${name.padEnd(28)} ${size}px at ${left},${top}  ` +
      `${placement ? 'placed (no mark present)' : `match ${spot.score.toFixed(2)}`}`,
  )
}

console.log(`\nstamped ${names.length} folders with the official CDL mark`)
