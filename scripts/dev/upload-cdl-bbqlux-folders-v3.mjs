/**
 * DEV-only: publish Luxury folder variants. Does not rewrite other packages.
 *
 *   node scripts/dev/upload-cdl-bbqlux-folders-v3.mjs
 *   node scripts/dev/upload-cdl-bbqlux-folders-v3.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const APPLY = process.argv.includes('--apply')
const COMPOSE = join(ROOT, 'scripts/dev/compose-bbqlux-folders-v3.py')
const SOURCE_DIR = join(ROOT, 'assets/packages/folders-v3')
const GENERATED = join(ROOT, 'Lib/publicQuote/packageFolderArt.generated.ts')
const BUCKET = 'package-images'
const PREFIX = 'cdl-folders-v3'
const FILES = [
  ['BBQLUX', 'pt', 'bbqlux-pt-v3.webp'],
  ['BBQLUX', 'en', 'bbqlux-en-v3.webp'],
  ['BBQLUX', 'es', 'bbqlux-es-v3.webp'],
  ['BBQLUX+', 'pt', 'bbqlux-plus-pt-v3.webp'],
  ['BBQLUX+', 'en', 'bbqlux-plus-en-v3.webp'],
  ['BBQLUX+', 'es', 'bbqlux-plus-es-v3.webp'],
]

const env = loadDevEnv(ROOT)
const ref = assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

execFileSync('python3', [COMPOSE], { stdio: 'inherit' })

const report = {
  project_ref: ref,
  uploaded: [],
  status: APPLY ? 'PENDING' : 'COMPOSED',
}

if (APPLY) {
  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  for (const [key, locale, file] of FILES) {
    const local = join(SOURCE_DIR, file)
    if (!existsSync(local)) {
      report.status = `MISSING:${file}`
      break
    }
    const body = readFileSync(local)
    const path = `${PREFIX}/${file}`
    const { error } = await sb.storage.from(BUCKET).upload(path, body, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) {
      report.status = `UPLOAD_FAIL:${file}:${error.message}`
      break
    }
    report.uploaded.push({ key, locale, path, bytes: body.length })
  }
  if (report.status === 'PENDING') report.status = 'UPLOADED'
}

const current = readFileSync(GENERATED, 'utf8')
if (!current.includes('"BBQLUX"') && !current.includes('BBQLUX:')) {
  const insertion = `  "BBQLUX": {
    "en": "bbqlux-en-v3.webp",
    "es": "bbqlux-es-v3.webp",
    "pt": "bbqlux-pt-v3.webp"
  },
  "BBQLUX+": {
    "en": "bbqlux-plus-en-v3.webp",
    "es": "bbqlux-plus-es-v3.webp",
    "pt": "bbqlux-plus-pt-v3.webp"
  },
`
  const next = current.replace(
    'export const PACKAGE_FOLDER_ART_V2: Record<\n  string,\n  Partial<Record<\'pt\' | \'en\' | \'es\', string>>\n> = {\n',
    `export const PACKAGE_FOLDER_ART_V2: Record<\n  string,\n  Partial<Record<'pt' | 'en' | 'es', string>>\n> = {\n${insertion}`,
  )
  if (next === current) {
    report.map_status = 'PATCH_FAIL'
  } else {
    writeFileSync(GENERATED, next)
    report.map_status = 'PATCHED'
  }
} else {
  report.map_status = 'ALREADY_PRESENT'
}

writeFileSync(
  join(ROOT, 'assets/packages/folder-bbqlux-v3.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
if (String(report.status).includes('FAIL') || report.map_status === 'PATCH_FAIL') {
  process.exit(1)
}
