#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadDevEnv, assertDevUrl, DEV_REF, PROD_REF } from './loadDevEnv.mjs'
import {
  aliasKeys,
  matchesHeroPlacement,
  restoreMissingCdlHeroMedia,
  RESTORE_TARGETS,
  PRESERVED_KEY,
  sortHeroRows,
} from './restore-missing-cdl-hero-media.mjs'

const ROOT = process.cwd()
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const PUBLIC_URLS = [
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/pt',
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/en',
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/es',
]
const REQUIRED_FILES = [
  'public/cdl/hero/cdl-grill-corn-flames.webp',
  'public/cdl/hero/cdl-event-pool-station.webp',
]

let passed = 0
let failed = 0

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function listStaticHeroAssets() {
  const dir = join(ROOT, 'public/cdl/hero')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.webp'))
    .map((name) => {
      const rel = `public/cdl/hero/${name}`
      const entityKey = `hero:${name.replace(/\.webp$/i, '')}`
      const mediaUrl = `/cdl/hero/${name}`
      return {
        file: rel,
        entityKey,
        mediaUrl,
        bytes: statSync(join(ROOT, rel)).size,
      }
    })
}

function reportStaticAssetsWithoutRows(assets, rows) {
  return assets.filter((asset) => {
    const keys = new Set(aliasKeys(asset.entityKey))
    return !rows.some(
      (row) =>
        keys.has(row.entity_key) ||
        row.media_url === asset.mediaUrl ||
        row.storage_path === asset.mediaUrl,
    )
  })
}

const env = loadDevEnv(ROOT)
report('ENV: supabase is DEV yasprgtlqclwsjcshtls', env.url.includes(DEV_REF) && !env.url.includes(PROD_REF))
if (env.url.includes(PROD_REF) || !env.url.includes(DEV_REF)) {
  console.error('PROD REF or unknown target — aborting.')
  process.exit(2)
}
assertDevUrl(env.url)

const restoreSrc = readFileSync(join(ROOT, 'scripts/dev/restore-missing-cdl-hero-media.mjs'), 'utf8')
const backfill = existsSync(join(ROOT, 'supabase/migrations/20260822201000_media_placement_backfill.sql'))
  ? readFileSync(join(ROOT, 'supabase/migrations/20260822201000_media_placement_backfill.sql'), 'utf8')
  : ''
report(
  'SRC: restore is data-only and does not apply backfill',
  restoreSrc.includes("placement: 'hero'") &&
    !restoreSrc.includes('apply:dev:media-migration') &&
    !restoreSrc.includes('20260822201000_media_placement_backfill.sql'),
)
report(
  'SRC: restore refuses to mutate the new grill photo key',
  restoreSrc.includes(PRESERVED_KEY) && restoreSrc.includes('refuse to restore without the new grill photo'),
)

for (const file of REQUIRED_FILES) {
  report(`FOUND FILE: ${file}`, existsSync(join(ROOT, file)), existsSync(join(ROOT, file)) ? `${statSync(join(ROOT, file)).size} bytes` : 'missing')
}

const admin = createClient(env.url, env.service, { auth: { persistSession: false } })
const { data: beforeRows, error: beforeError } = await admin
  .from('media_assets')
  .select('id, company_id, entity_key, media_url, storage_path, placement, display_order, active, editor_meta')
  .eq('company_id', CDL_ID)
  .eq('entity_type', 'public_landing')
if (beforeError) {
  report('FORENSIC: media_assets readable', false, beforeError.message)
  process.exit(1)
}

const beforeHero = sortHeroRows((beforeRows || []).filter(matchesHeroPlacement))
const grillNew = beforeHero.find((row) => row.entity_key === PRESERVED_KEY)
report(
  'CHURRASQUEIRA NOVA FOUND / ACTIVE',
  grillNew?.id === '96f4e815-7643-4940-8b86-ad44a6693a85' && grillNew.active === true,
  grillNew ? `${grillNew.id} order=${grillNew.display_order}` : 'missing',
)

const staticAssets = listStaticHeroAssets()
const missingBefore = reportStaticAssetsWithoutRows(staticAssets, beforeRows || [])
report(
  'STATIC_HERO_ASSET_WITHOUT_MEDIA_ROW_IS_REPORTED',
  Array.isArray(missingBefore),
  missingBefore.map((item) => item.entityKey).join(',') || 'none',
)
for (const target of RESTORE_TARGETS) {
  const row = (beforeRows || []).find((item) => aliasKeys(target.entityKey).includes(item.entity_key))
  report(
    `ROW BEFORE ${target.entityKey}`,
    true,
    row ? `id=${row.id} active=${row.active}` : 'missing',
  )
}

const first = await restoreMissingCdlHeroMedia()
const firstIds = Object.fromEntries(first.actions.map((action) => [action.entityKey, action.id]))
report(
  'RESTORE_MISSING_HERO_MEDIA',
  first.playlist.some((row) => row.entityKey === 'hero:cdl-grill-corn-flames' && row.active) &&
    first.playlist.some((row) => row.entityKey === 'hero:cdl-event-pool-station' && row.active) &&
    first.playlist[0]?.entityKey === PRESERVED_KEY,
  first.playlist.map((row) => `${row.displayOrder}:${row.entityKey}`).join('|'),
)

const second = await restoreMissingCdlHeroMedia()
const secondIds = Object.fromEntries(second.actions.map((action) => [action.entityKey, action.id]))
const duplicateInsert = second.actions.some((action) => action.action === 'inserted')
report(
  'NO_DUPLICATE_RESTORE',
  !duplicateInsert &&
    second.playlist.length === first.playlist.length &&
    secondIds['hero:cdl-grill-corn-flames'] === firstIds['hero:cdl-grill-corn-flames'] &&
    secondIds['hero:cdl-event-pool-station'] === firstIds['hero:cdl-event-pool-station'] &&
    second.actions.every((action) => action.action === 'already_present' || action.action === 'already_present_alias' || action.action === 'patched_same_row'),
  second.actions.map((action) => `${action.entityKey}:${action.action}`).join('|'),
)

const { data: afterRows } = await admin
  .from('media_assets')
  .select('id, entity_key, media_url, storage_path, placement, display_order, active, editor_meta')
  .eq('company_id', CDL_ID)
  .eq('entity_type', 'public_landing')
const afterHero = sortHeroRows((afterRows || []).filter(matchesHeroPlacement))
const missingAfter = reportStaticAssetsWithoutRows(staticAssets, afterRows || [])
const requiredStillMissing = missingAfter.filter((item) =>
  RESTORE_TARGETS.some((target) => target.entityKey === item.entityKey),
)
report(
  'STATIC_HERO_ASSET_WITHOUT_MEDIA_ROW_IS_REPORTED:required-restored',
  requiredStillMissing.length === 0,
  missingAfter.map((item) => item.entityKey).join(',') || 'none remaining',
)

const orders = afterHero.map((row) => Number(row.display_order))
report(
  'PLAYLIST 1..N no duplicates',
  orders.join(',') === afterHero.map((_, index) => index + 1).join(',') &&
    afterHero[0]?.entity_key === PRESERVED_KEY,
  orders.join(','),
)

for (const target of RESTORE_TARGETS) {
  const row = afterHero.find((item) => item.entity_key === target.entityKey)
  const applied = row?.editor_meta?.applied || {}
  const suggested = row?.editor_meta?.suggested || {}
  report(
    `ROW AFTER ${target.entityKey}`,
    Boolean(row?.id) &&
      row.active === true &&
      (row.placement === 'hero' || (row.placement == null && row.entity_key.startsWith('hero:'))) &&
      row.media_url === target.mediaUrl &&
      Number.isFinite(applied.mobile?.x) &&
      Number.isFinite(applied.tablet?.x) &&
      Number.isFinite(applied.desktop?.x) &&
      Number.isFinite(suggested.mobile?.x),
    row ? `id=${row.id} order=${row.display_order} applied.mobile=${applied.mobile?.x},${applied.mobile?.y}` : 'missing',
  )
}

const publicKeys = afterHero.filter((row) => row.active === true).map((row) => row.entity_key)
report(
  'RESTORED_HERO_ROW_APPEARS_PUBLICLY:db',
  publicKeys.includes('hero:cdl-grill-corn-flames') &&
    publicKeys.includes('hero:cdl-event-pool-station') &&
    publicKeys.includes(PRESERVED_KEY),
  `count=${publicKeys.length}`,
)
report(
  'MOBILE_PLAYLIST_INCLUDES_RESTORED_MEDIA:db',
  afterHero
    .filter((row) =>
      ['hero:cdl-grill-corn-flames', 'hero:cdl-event-pool-station', PRESERVED_KEY].includes(row.entity_key),
    )
    .every((row) => row.active === true && Number.isFinite(row.editor_meta?.applied?.mobile?.x)),
)

let htmlOk = true
let htmlDetail = []
for (const url of PUBLIC_URLS) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    redirect: 'manual',
  })
  const html = await response.text()
  const countMatch = html.match(/data-hero-photo-count="(\d+)"/)
  const count = Number(countMatch?.[1] || 0)
  const hasNewGrill = html.includes('item-1787407319293')
  const hasCorn = html.includes('cdl-grill-corn-flames')
  const hasTent = html.includes('cdl-event-pool-station')
  const publicPage = response.status === 200 && !html.includes('/login')
  const ok =
    publicPage &&
    hasNewGrill &&
    hasCorn &&
    hasTent &&
    count === afterHero.filter((row) => row.active === true).length
  htmlOk = htmlOk && ok
  htmlDetail.push(`${url.split('/').slice(-2).join('/')} status=${response.status} count=${count} grill=${hasNewGrill} corn=${hasCorn} tent=${hasTent}`)
}
report('RESTORED_HERO_ROW_APPEARS_PUBLICLY:html', htmlOk, htmlDetail.join(' | '))
report('MOBILE_PLAYLIST_INCLUDES_RESTORED_MEDIA:html', htmlOk)

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
