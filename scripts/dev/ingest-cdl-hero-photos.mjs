/**
 * Copy CDL public-quote hero photographs into originals/ and emit WebP.
 * Does not download stock, generate AI images, or overwrite originals.
 *
 * Run: node scripts/dev/ingest-cdl-hero-photos.mjs
 */
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ORIGINALS = join(ROOT, 'assets/branding/cdl/hero/originals')
const INBOX = join(ROOT, 'assets/branding/cdl/hero/inbox')
const PUBLIC_DIR = join(ROOT, 'public/cdl/hero')
const MANIFEST = join(ROOT, 'assets/branding/cdl/hero/manifest.json')

/**
 * Curated visual order for the CDL public landing.
 * Finished plates → sliced meats → live fire → event/pool → operation →
 * fleet → ingredients. Exact byte duplicates are listed once.
 */
const PHOTOS = [
  {
    id: 'cdl-canape-sausage-crostini',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21 (2).jpeg',
    originalName: 'cdl-canape-sausage-crostini-original.jpeg',
    publicName: 'cdl-canape-sausage-crostini.webp',
    alt: 'CDL sausage crostini canapés on a branded wooden board',
    mobilePosition: '50% 42%',
    desktopPosition: '50% 38%',
    required: true,
  },
  {
    id: 'cdl-sliced-beef-rosemary',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21 (1).jpeg',
    originalName: 'cdl-sliced-beef-rosemary-original.jpeg',
    publicName: 'cdl-sliced-beef-rosemary.webp',
    alt: 'Sliced grilled beef with rosemary served on a wooden platter',
    mobilePosition: '50% 40%',
    desktopPosition: '50% 36%',
    required: true,
  },
  {
    id: 'cdl-grill-flames-steaks',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21.jpeg',
    originalName: 'cdl-grill-flames-steaks-original.jpeg',
    publicName: 'cdl-grill-flames-steaks.webp',
    alt: 'Steaks and sausages searing over live flames',
    mobilePosition: '50% 48%',
    desktopPosition: '50% 42%',
    required: true,
  },
  {
    id: 'cdl-platter-picanha-farofa-pool',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.24 (2).jpeg',
    originalName: 'cdl-platter-picanha-farofa-pool-original.jpeg',
    publicName: 'cdl-platter-picanha-farofa-pool.webp',
    alt: 'Picanha slices around farofa served poolside',
    mobilePosition: '50% 40%',
    desktopPosition: '48% 36%',
    required: true,
  },
  {
    id: 'cdl-bacon-scallops',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.24 (3).jpeg',
    originalName: 'cdl-bacon-scallops-original.jpeg',
    publicName: 'cdl-bacon-scallops.webp',
    alt: 'Bacon-wrapped scallops on a wooden catering plate',
    mobilePosition: '50% 42%',
    desktopPosition: '50% 38%',
    required: true,
  },
  {
    id: 'cdl-sunset-waterfront-grill',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.24.jpeg',
    originalName: 'cdl-sunset-waterfront-grill-original.jpeg',
    publicName: 'cdl-sunset-waterfront-grill.webp',
    alt: 'Picanha grilling over flames at a waterfront sunset',
    mobilePosition: '50% 62%',
    desktopPosition: '50% 58%',
    required: true,
  },
  {
    id: 'cdl-mixed-platter-bull-grill',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.23 (1).jpeg',
    originalName: 'cdl-mixed-platter-bull-grill-original.jpeg',
    publicName: 'cdl-mixed-platter-bull-grill.webp',
    alt: 'Mixed grilled meats, corn and garlic bread on a serving board',
    mobilePosition: '50% 42%',
    desktopPosition: '50% 38%',
    required: true,
  },
  {
    id: 'cdl-event-pool-station',
    sourceFilename: 'cdl-event-pool-station.jpeg',
    originalName: 'cdl-event-pool-station-original.jpeg',
    publicName: 'cdl-event-pool-station.webp',
    alt: 'CDL Brazilian BBQ station under a branded tent beside a luxury pool',
    mobilePosition: '50% 42%',
    desktopPosition: '48% 38%',
    required: true,
  },
  {
    id: 'cdl-board-steak-zucchini',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.22 (1).jpeg',
    originalName: 'cdl-board-steak-zucchini-original.jpeg',
    publicName: 'cdl-board-steak-zucchini.webp',
    alt: 'CDL branded board with steak, chicken and grilled vegetables',
    mobilePosition: '50% 48%',
    desktopPosition: '50% 42%',
    required: true,
  },
  {
    id: 'cdl-grill-lamb-hearts',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.20 (1).jpeg',
    originalName: 'cdl-grill-lamb-hearts-original.jpeg',
    publicName: 'cdl-grill-lamb-hearts.webp',
    alt: 'Lamb chops, chicken hearts and spiral sausage on a commercial grill',
    mobilePosition: '50% 52%',
    desktopPosition: '50% 46%',
    required: true,
  },
  {
    id: 'cdl-poolside-brazilian-spread',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.23.jpeg',
    originalName: 'cdl-poolside-brazilian-spread-original.jpeg',
    publicName: 'cdl-poolside-brazilian-spread.webp',
    alt: 'Brazilian BBQ platters and sauces beside a swimming pool',
    mobilePosition: '50% 42%',
    desktopPosition: '48% 38%',
    required: true,
  },
  {
    id: 'cdl-grill-corn-flames',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.20.jpeg',
    originalName: 'cdl-grill-corn-flames-original.jpeg',
    publicName: 'cdl-grill-corn-flames.webp',
    alt: 'Corn, steaks and sausages cooking over grill flames',
    mobilePosition: '50% 48%',
    desktopPosition: '50% 42%',
    required: true,
  },
  {
    id: 'cdl-fleet-neighborhood',
    sourceFilename: 'cdl-fleet-neighborhood.jpeg',
    originalName: 'cdl-fleet-neighborhood-original.jpeg',
    publicName: 'cdl-fleet-neighborhood.webp',
    alt: 'CDL Services branded catering van at a residential event',
    mobilePosition: '50% 55%',
    desktopPosition: '46% 52%',
    required: true,
  },
  {
    id: 'cdl-raw-tomahawk-wolf',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21 (3).jpeg',
    originalName: 'cdl-raw-tomahawk-wolf-original.jpeg',
    publicName: 'cdl-raw-tomahawk-wolf.webp',
    alt: 'Raw tomahawk steak held in front of an outdoor grill',
    mobilePosition: '50% 40%',
    desktopPosition: '50% 36%',
    required: true,
  },
  {
    id: 'cdl-vacuum-premium-meats',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.22.jpeg',
    originalName: 'cdl-vacuum-premium-meats-original.jpeg',
    publicName: 'cdl-vacuum-premium-meats.webp',
    alt: 'Premium vacuum-sealed meats prepared poolside for churrasco',
    mobilePosition: '50% 55%',
    desktopPosition: '50% 48%',
    required: true,
  },
]

const SEARCH_ROOTS = [
  INBOX,
  ORIGINALS,
  join(ROOT, 'public/cdl/hero'),
  ROOT,
  '/tmp/cdl-wix-photos',
  '/tmp',
  '/home/ubuntu',
  '/opt/cursor',
]

function walkFiles(dir, depth = 0, out = []) {
  if (depth > 4 || !existsSync(dir)) return out
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === '.next'
    ) {
      continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, depth + 1, out)
    else out.push(full)
  }
  return out
}

function findSource(photo) {
  const wanted = photo.sourceFilename.toLowerCase()
  const originalPath = join(ORIGINALS, photo.originalName)
  if (existsSync(originalPath)) return originalPath

  for (const root of SEARCH_ROOTS) {
    for (const file of walkFiles(root)) {
      const base = file.split('/').pop()?.toLowerCase() ?? ''
      if (base === wanted) return file
      if (base === photo.originalName.toLowerCase()) return file
    }
  }
  return null
}

function probeImage(path) {
  const raw = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      path,
    ],
    { encoding: 'utf8' },
  ).trim()
  const [width, height] = raw.split(',').map((value) => Number(value))
  return {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    bytes: statSync(path).size,
  }
}

mkdirSync(ORIGINALS, { recursive: true })
mkdirSync(INBOX, { recursive: true })
mkdirSync(PUBLIC_DIR, { recursive: true })

const report = []
let missingRequired = 0
let missingOptional = 0

for (const photo of PHOTOS) {
  const found = findSource(photo)
  if (!found) {
    if (photo.required) missingRequired += 1
    else missingOptional += 1
    report.push({
      id: photo.id,
      sourceFilename: photo.sourceFilename,
      found: false,
      required: Boolean(photo.required),
    })
    console.error(
      `${photo.required ? 'MISSING' : 'PENDING'}  ${photo.id}  (${photo.sourceFilename})`,
    )
    continue
  }

  const originalPath = join(ORIGINALS, photo.originalName)
  if (found !== originalPath && !existsSync(originalPath)) {
    copyFileSync(found, originalPath)
  }
  const publicPath = join(PUBLIC_DIR, photo.publicName)
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      originalPath,
      '-vf',
      'scale=1920:1920:force_original_aspect_ratio=decrease',
      '-c:v',
      'libwebp',
      '-quality',
      '84',
      '-compression_level',
      '4',
      publicPath,
    ],
    { stdio: 'pipe' },
  )
  const original = probeImage(originalPath)
  const optimized = probeImage(publicPath)
  report.push({
    id: photo.id,
    sourceFilename: photo.sourceFilename,
    found: true,
    originalPath: originalPath.replace(`${ROOT}/`, ''),
    optimizedPath: publicPath.replace(`${ROOT}/`, ''),
    original,
    optimized,
    alt: photo.alt,
    mobilePosition: photo.mobilePosition,
    desktopPosition: photo.desktopPosition,
  })
  console.log(
    `OK  ${photo.id}  ${original.width}x${original.height} ${original.bytes}B → ${optimized.width}x${optimized.height} ${optimized.bytes}B`,
  )
}

writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      photos: report,
    },
    null,
    2,
  )}\n`,
)

if (missingRequired > 0) {
  console.error(
    `\n${missingRequired} required CDL photograph(s) were not in the workspace. Import files into assets/branding/cdl/hero/inbox/ and re-run this script. Do not substitute stock or AI images.`,
  )
  process.exit(1)
}

if (missingOptional > 0) {
  console.log(
    `\n${missingOptional} optional camera-roll photograph(s) are still pending inbox import.`,
  )
}

console.log('\nCDL public hero photographs ingested.')
