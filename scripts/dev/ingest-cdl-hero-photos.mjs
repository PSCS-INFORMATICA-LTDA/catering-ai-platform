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
 * Priority: finished plates → sliced meats → live fire → station/event → pool → fleet.
 * Optional UUID camera-roll files stay mapped so they ingest when dropped in inbox.
 */
const PHOTOS = [
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
    id: 'cdl-event-tent',
    sourceFilename: '12A42ED0-52E8-4D95-BAE0-E2A58F200A26.jpeg',
    originalName: 'cdl-event-tent-original.jpeg',
    publicName: 'cdl-event-tent.webp',
    alt: 'CDL branded event tent and serving station',
    mobilePosition: '50% 68%',
    desktopPosition: '48% 62%',
    required: false,
  },
  {
    id: 'cdl-event-van',
    sourceFilename: 'E91AAB0B-CD8C-4C9A-946B-71AFEBE96C96.jpeg',
    originalName: 'cdl-event-van-original.jpeg',
    publicName: 'cdl-event-van.webp',
    alt: 'CDL catering van at a luxury residence',
    mobilePosition: '50% 78%',
    desktopPosition: '46% 72%',
    required: false,
  },
  {
    id: 'cdl-event-buffet',
    sourceFilename: 'BCC58DBB-6448-4AFE-85C1-C8277D075AEE.jpeg',
    originalName: 'cdl-event-buffet-original.jpeg',
    publicName: 'cdl-event-buffet.webp',
    alt: 'CDL Brazilian BBQ buffet presentation',
    mobilePosition: '50% 58%',
    desktopPosition: '50% 62%',
    required: false,
  },
  {
    id: 'cdl-event-board',
    sourceFilename: '228C5DB0-5F5F-4B30-B72E-7E3337965435.jpeg',
    originalName: 'cdl-event-board-original.jpeg',
    publicName: 'cdl-event-board.webp',
    alt: 'Finished CDL churrasco board at an outdoor event',
    mobilePosition: '50% 62%',
    desktopPosition: '48% 58%',
    required: false,
  },
  {
    id: 'cdl-event-fleet',
    sourceFilename: '14D84C20-F765-434F-9EAE-444855C148C4.jpeg',
    originalName: 'cdl-event-fleet-original.jpeg',
    publicName: 'cdl-event-fleet.webp',
    alt: 'CDL van and trailer arriving at a luxury event',
    mobilePosition: '50% 76%',
    desktopPosition: '44% 70%',
    required: false,
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
