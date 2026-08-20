/**
 * Copy official CDL hero photographs into originals/ and emit web-optimized WebP.
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
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ORIGINALS = join(ROOT, 'assets/branding/cdl/hero/originals')
const INBOX = join(ROOT, 'assets/branding/cdl/hero/inbox')
const PUBLIC_DIR = join(ROOT, 'public/cdl/hero')
const MANIFEST = join(ROOT, 'assets/branding/cdl/hero/manifest.json')

const PHOTOS = [
  {
    id: 'cdl-event-tent',
    sourceFilename: '76898515-AADD-4FFF-BBB4-273F2636AA04.jpeg',
    originalName: 'cdl-event-tent-original.jpeg',
    publicName: 'cdl-event-tent.webp',
  },
  {
    id: 'cdl-event-van',
    sourceFilename: '91694055-DC62-4AC4-96E6-38F84FBF0DF4.jpeg',
    originalName: 'cdl-event-van-original.jpeg',
    publicName: 'cdl-event-van.webp',
  },
  {
    id: 'cdl-event-buffet',
    sourceFilename: '487F78B9-EC4D-4A78-8CA5-56D1CE70FD24.jpeg',
    originalName: 'cdl-event-buffet-original.jpeg',
    publicName: 'cdl-event-buffet.webp',
  },
  {
    id: 'cdl-event-board',
    sourceFilename: '8BFFD641-8C3A-4D1E-BE2D-461E02C1B338.jpeg',
    originalName: 'cdl-event-board-original.jpeg',
    publicName: 'cdl-event-board.webp',
  },
  {
    id: 'cdl-event-fleet',
    sourceFilename: '3BCF655C-CE8B-4DE2-8663-2CAC8EB5E638.jpeg',
    originalName: 'cdl-event-fleet-original.jpeg',
    publicName: 'cdl-event-fleet.webp',
  },
]

const SEARCH_ROOTS = [
  INBOX,
  ORIGINALS,
  join(ROOT, 'public/cdl/hero'),
  ROOT,
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
let missing = 0

for (const photo of PHOTOS) {
  const found = findSource(photo)
  if (!found) {
    missing += 1
    report.push({
      id: photo.id,
      sourceFilename: photo.sourceFilename,
      found: false,
    })
    console.error(`MISSING  ${photo.id}  (${photo.sourceFilename})`)
    continue
  }

  const originalPath = join(ORIGINALS, photo.originalName)
  if (found !== originalPath) {
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
  })
  console.log(
    `OK  ${photo.id}  ${original.width}x${original.height} ${original.bytes}B → ${optimized.width}x${optimized.height} ${optimized.bytes}B`,
  )
}

writeFileSync(MANIFEST, `${JSON.stringify({ generatedAt: new Date().toISOString(), photos: report }, null, 2)}\n`)

if (missing > 0) {
  console.error(
    `\n${missing} official CDL photograph(s) were not in the workspace. Import the Product Owner files into assets/branding/cdl/hero/inbox/ and re-run this script. Do not substitute stock or AI images.`,
  )
  process.exit(1)
}

console.log('\nAll five CDL hero photographs ingested.')
