#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadDevEnv, assertDevUrl, DEV_REF, PROD_REF } from './loadDevEnv.mjs'

const ROOT = process.cwd()
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const SEQ15_ID = '74c44168-559e-4095-b734-49dfb6b4fce5'
const SEQ15_KEY = 'hero:item-mt4xmgzy83es'
const PUBLIC_URLS = [
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/pt',
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/en',
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/es',
]

let passed = 0
let failed = 0

function read(rel) {
  return existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : ''
}

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function matchesHero(row) {
  return row?.placement === 'hero' || (row?.placement == null && String(row?.entity_key || '').startsWith('hero:'))
}

const env = loadDevEnv(ROOT)
report('ENV: supabase is DEV', env.url.includes(DEV_REF) && !env.url.includes(PROD_REF))
if (env.url.includes(PROD_REF) || !env.url.includes(DEV_REF)) {
  process.exit(2)
}
assertDevUrl(env.url)

const nextConfig = read('next.config.ts')
const hero = read('components/quotes/PublicQuoteHeroMedia.tsx')
const mapPublic = read('Lib/media/mapPublicHero.ts')
const srcHelper = read('Lib/media/publicHeroSrc.ts')
const loader = read('Lib/media/loadPublishedPublicMedia.ts')
const repo = read('Lib/media/repository.ts')
const experience = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx')
const collect = read('Lib/publicQuote/heroMedia.ts')
const bulk = read('app/api/media/assets/bulk-active/route.ts')

const publicHeroFiles = [hero, mapPublic, srcHelper, loader, repo, experience, collect, nextConfig]
report(
  'HERO_HAS_NO_FIXED_ITEM_LIMIT',
  publicHeroFiles.every((file) => !/slice\(\s*0\s*,\s*(10|12)\s*\)/.test(file)) &&
    !loader.includes('limit(10)') &&
    !loader.includes('limit(12)') &&
    !hero.includes('MAX_HERO') &&
    !collect.includes('MAX_HERO') &&
    loader.includes('listPublishedPublicMedia') &&
    !loader.includes('.slice('),
)

report(
  'SUPABASE_STORAGE_HERO_URL_IS_ACCEPTED:src',
  nextConfig.includes("hostname: '*.supabase.co'") &&
    nextConfig.includes("pathname: '/storage/v1/object/public/**'") &&
    srcHelper.includes('isSupabasePublicStorageSrc') &&
    srcHelper.includes('/storage/v1/object/public/') &&
    mapPublic.includes('isAllowedPublicHeroSrc') &&
    !mapPublic.includes("startsWith('/cdl/hero')") &&
    hero.includes('unoptimized={rawFallbackIds.has(item.id)}'),
)

report(
  'ACTIVATE_REVALIDATES_PUBLIC',
  bulk.includes('revalidatePublicMediaPages') &&
    read('Lib/media/revalidatePublic.ts').includes("revalidatePath('/quote/[companySlug]/[locale]', 'page')"),
)

const admin = createClient(env.url, env.service, { auth: { persistSession: false } })
const { data: row, error: rowError } = await admin
  .from('media_assets')
  .select('id, company_id, entity_key, media_url, placement, display_order, active, variant, editor_meta')
  .eq('id', SEQ15_ID)
  .maybeSingle()

report(
  'ACTIVE_BATCH_HERO_IS_PUBLIC:db',
  !rowError &&
    row?.id === SEQ15_ID &&
    row.entity_key === SEQ15_KEY &&
    row.company_id === CDL_ID &&
    row.placement === 'hero' &&
    row.active === true &&
    row.display_order === 15 &&
    String(row.media_url || '').includes('/storage/v1/object/public/') &&
    String(row.media_url || '').includes('yasprgtlqclwsjcshtls.supabase.co'),
  rowError?.message || `order=${row?.display_order} active=${row?.active}`,
)

const { data: landing } = await admin
  .from('media_assets')
  .select('id, entity_key, placement, display_order, active, media_url, editor_meta')
  .eq('company_id', CDL_ID)
  .eq('entity_type', 'public_landing')

const dbActive = (landing || [])
  .filter((item) => item.active === true && matchesHero(item))
  .sort((a, b) => {
    const order = Number(a.display_order || 0) - Number(b.display_order || 0)
    return order !== 0 ? order : String(a.id).localeCompare(String(b.id))
  })

const seq15Index = dbActive.findIndex((item) => item.id === SEQ15_ID)
const appliedMobile = row?.editor_meta?.applied?.mobile
report(
  'SEQ_15_UNCHANGED',
  row?.entity_key === SEQ15_KEY && row?.display_order === 15 && Boolean(row?.media_url),
)
report(
  'MOBILE_USES_APPLIED_NOT_SUGGESTED',
  mapPublic.includes('focusToCss(editor.applied.mobile)') &&
    !mapPublic.includes('editor.suggested') &&
    Number.isFinite(appliedMobile?.x),
  appliedMobile ? `${appliedMobile.x},${appliedMobile.y}` : 'missing applied.mobile',
)

let htmlOk = true
let countMismatch = false
const htmlDetails = []
for (const url of PUBLIC_URLS) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    redirect: 'manual',
  })
  const html = await response.text()
  const count = Number((html.match(/data-hero-photo-count="(\d+)"/) || [])[1] || 0)
  const indicators = [...html.matchAll(/data-hero-indicator="([^"]+)"/g)].map((match) => match[1])
  const hasSeq15 = html.includes('item-mt4xmgzy83es')
  const hasStorage = html.includes('/storage/v1/object/public/')
  const ok =
    response.status === 200 &&
    hasSeq15 &&
    hasStorage &&
    count === dbActive.length &&
    indicators.some((id) => id.includes('item-mt4xmgzy83es'))
  htmlOk = htmlOk && ok
  if (count !== dbActive.length) countMismatch = true
  htmlDetails.push(`${url.split('/').slice(-2).join('/')} status=${response.status} count=${count} db=${dbActive.length} seq15=${hasSeq15}`)
}

report('ACTIVE_BATCH_HERO_IS_PUBLIC:html', htmlOk, htmlDetails.join(' | '))
report(
  'DB_ACTIVE_HERO_COUNT_EQUALS_PUBLIC_COUNT',
  !countMismatch && dbActive.length >= 13 && htmlOk,
  `db=${dbActive.length}`,
)
report(
  'SEQ_15_HERO_ITEM_RENDERS',
  htmlOk && seq15Index >= 0 && dbActive[seq15Index]?.display_order === 15,
  `playlistIndex=${seq15Index + 1}/${dbActive.length} display_order=15`,
)

if (row?.media_url) {
  const storage = await fetch(row.media_url, { method: 'HEAD' })
  report(
    'SUPABASE_STORAGE_HERO_URL_IS_ACCEPTED:http',
    storage.status === 200 && String(storage.headers.get('content-type') || '').startsWith('image/'),
    `storage=${storage.status} type=${storage.headers.get('content-type')}`,
  )
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
