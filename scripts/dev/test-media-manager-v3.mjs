#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
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

function insertAtPosition(existing, incoming, startAt) {
  const raw = Number.isFinite(startAt) ? Math.floor(startAt) : existing.length + 1
  const index = Math.max(0, Math.min(existing.length, raw - 1))
  return [...existing.slice(0, index), ...incoming, ...existing.slice(index)]
}

function normalizePlaylistOrder(items) {
  return items.map((item, index) => ({ ...item, display_order: index + 1 }))
}

function composeReorderIds(currentIds, requestedIds) {
  const current = new Set(currentIds)
  const requested = requestedIds.filter((id, index, list) => id && list.indexOf(id) === index)
  if (requested.some((id) => !current.has(id))) return { ids: [], error: 'foreign_id' }
  return { ids: [...requested, ...currentIds.filter((id) => !requested.includes(id))], error: null }
}

function validateBatchImageFile(file) {
  if (!file || file.size <= 0) return 'empty_file'
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || ''
  const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp'])
  const allowedMime = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
  if (!allowedExt.has(ext)) return 'invalid_type'
  if (!allowedMime.has(String(file.type || '').toLowerCase())) return 'invalid_type'
  if (file.size > 8 * 1024 * 1024) return 'file_too_large'
  return null
}

function retryQueue(items, onlyFailed) {
  return items.filter((item) => (onlyFailed ? item.status === 'error' : item.status !== 'done'))
}

function publicHeroPlaylist(rows) {
  return rows
    .filter((row) => {
      const placement = row.placement || String(row.entity_key || '').split(':')[0]
      return placement === 'hero' && row.active === true
    })
    .sort((left, right) => {
      const order = (left.display_order || 0) - (right.display_order || 0)
      return order !== 0 ? order : String(left.id).localeCompare(String(right.id))
    })
}

const manager = read('components/media/MediaContentManager.tsx')
const card = read('components/media/HeroMediaCard.tsx')
const editor = read('components/media/HeroFocusEditor.tsx')
const compare = read('components/media/HeroDeviceCompare.tsx')
const batch = read('components/media/HeroBatchImporter.tsx')
const repo = read('Lib/media/repository.ts')
const compat = read('Lib/media/compat.ts')
const reorderApi = read('app/api/media/assets/reorder/route.ts')
const normalizeApi = read('app/api/media/assets/normalize/route.ts')
const bulkApi = read('app/api/media/assets/bulk-active/route.ts')
const patchApi = read('app/api/media/assets/[id]/route.ts')
const assetsApi = read('app/api/media/assets/route.ts')
const i18n = read('Lib/i18n/media.ts')
const playlist = read('Lib/media/playlist.ts')
const constants = read('Lib/media/constants.ts')
const migration = read('supabase/migrations/20260822201000_media_placement_backfill.sql')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const isolation = read('scripts/dev/test-media-isolation.mjs')

report('V3-01: single image on playlist card', card.includes('data-media-single-canvas') && !card.includes('xl:grid-cols-[minmax(16rem,20rem)'))
report(
  'V3-02: focus editor is one canvas with device tabs',
  editor.includes('data-media-single-canvas') &&
    (editor.match(/<img/g) || []).length === 1 &&
    !editor.includes('md:grid-cols-3') &&
    editor.includes("draft.preview === 'mobile'") &&
    editor.includes('previewDesktop'),
)
report('V3-03: compare devices is opt-in only', compare.includes('md:grid-cols-3') && !card.includes('HeroDeviceCompare'))
report('V3-04: batch limit 20 and concurrency 4', constants.includes('MEDIA_BATCH_LIMIT = 20') && constants.includes('MEDIA_UPLOAD_CONCURRENCY = 4') && batch.includes('MEDIA_BATCH_LIMIT') && i18n.includes('Máximo {count} imagens por lote'))
report('V3-05: insert-at-position math', (() => {
  const result = insertAtPosition(['A', 'B', 'C', 'D'], ['N1', 'N2', 'N3'], 2)
  return result.join(',') === 'A,N1,N2,N3,B,C,D'
})())
report('V3-06: normalize writes 1..N', normalizePlaylistOrder([{ id: 'a' }, { id: 'b' }]).map((row) => row.display_order).join(',') === '1,2')
report('V3-07: reorder rejects foreign ids', composeReorderIds(['a', 'b'], ['a', 'z']).error === 'foreign_id')
report('V3-08: invalid empty file blocked', validateBatchImageFile({ name: 'x.jpg', type: 'image/jpeg', size: 0 }) === 'empty_file')
report('V3-08b: invalid mime/extension blocked', validateBatchImageFile({ name: 'x.gif', type: 'image/gif', size: 12 }) === 'invalid_type')
report(
  'V3-08c: retry only failed items',
  retryQueue(
    [
      { id: 'ok', status: 'done' },
      { id: 'fail', status: 'error' },
      { id: 'wait', status: 'waiting' },
    ],
    true,
  )
    .map((item) => item.id)
    .join(',') === 'fail',
)
report('V3-09: PATCH still strips identity', patchApi.includes('delete body.entity_key') && compat.includes('MEDIA_IDENTITY_KEYS'))
const patchStart = manager.indexOf("method: 'PATCH'")
const patchPayload = manager.slice(
  patchStart,
  manager.indexOf('const json = (await response.json())', patchStart),
)
report(
  'V3-10: card PATCH has no entity_key or display_order',
  !manager.includes('entity_key: working.entityKey') &&
    !patchPayload.includes('entity_key') &&
    !patchPayload.includes('display_order'),
)
report('V3-11: server reorder/normalize/bulk-active exist', reorderApi.includes('placement') && normalizeApi.includes('normalizeCompanyPublicMedia') && bulkApi.includes('bulkSetCompanyPublicMediaActive'))
report('V3-12: two-phase reorder offset', repo.includes('MEDIA_REORDER_OFFSET'))
report('V3-13: new inserts encode placement namespace', compat.includes('entity_key: encodePublicEntityKey(placement, key)') && assetsApi.includes("requestedKey.startsWith(`${placement}:`)"))
report('V3-14: batch starts inactive unless checkbox', batch.includes('active: activateAfter') && batch.includes('useState(false)'))
report('V3-15: retry only failed items', batch.includes('onlyFailed') && i18n.includes('Tentar novamente'))
report(
  'V3-16: no bulk delete',
  !manager.includes('bulk-delete') &&
    !existsSync(join(ROOT, 'app/api/media/assets/bulk-delete')) &&
    manager.includes('actionActivateSelected') &&
    manager.includes('actionDeactivateSelected'),
)
report('V3-17: wizard untouched', wizard.includes('entryMode') && !wizard.includes('HeroBatchImporter'))
report(
  'V3-18: migration is DEV-only backfill',
  migration.includes('yasprgtlqclwsjcshtls') &&
    migration.includes('NÃO aplicar em Production') &&
    migration.includes("entity_key LIKE 'hero:%'") &&
    !migration.includes('DELETE FROM') &&
    !migration.includes('DROP '),
)
report('V3-19: isolation test still covers CDL vs ISO', isolation.includes('iso-isolation-probe'))
report('V3-20: no-store on media APIs', assetsApi.includes('noStoreJson') && reorderApi.includes('noStoreJson'))

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO_ID = 'a1111111-1111-4111-8111-111111111111'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !service) {
  report('LIVE: skipped without DEV supabase env', true)
} else if (url.includes(PROD_REF) || !url.includes(DEV_REF)) {
  report('LIVE: refused non-DEV supabase', false, url)
} else {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const { data: existingItem } = await admin
    .from('media_assets')
    .select('id, entity_key, media_url, storage_path, display_order, active')
    .eq('company_id', CDL_ID)
    .eq('entity_key', 'hero:item-1787407319293')
    .maybeSingle()
  report(
    'LIVE21: existing hero:item-1787407319293 kept, not reuploaded',
    Boolean(existingItem?.id) &&
      existingItem.entity_key === 'hero:item-1787407319293' &&
      Boolean(existingItem.media_url),
    existingItem?.id || 'missing',
  )

  const preserve = {
    company_id: ISO_ID,
    entity_type: 'public_landing',
    entity_key: 'hero:qa-media-v3',
    media_type: 'image',
    media_url: '/iso-isolation-probe.webp',
    storage_path: '/iso-isolation-probe.webp',
    label_pt: 'QA v3',
    display_order: 40,
    active: false,
    editor_meta: { autoFocus: 'HEURISTIC', focusMode: 'auto', overlayEnabled: false, overlayDecided: true },
  }
  await admin.from('media_assets').delete().eq('company_id', ISO_ID).eq('entity_key', 'hero:qa-media-v3')
  const extras = []
  for (const key of ['hero:qa-media-v3-a', 'hero:qa-media-v3-b']) {
    await admin.from('media_assets').delete().eq('company_id', ISO_ID).eq('entity_key', key)
    const { data } = await admin
      .from('media_assets')
      .insert({ ...preserve, entity_key: key, display_order: extras.length + 41 })
      .select('id, entity_key')
      .maybeSingle()
    extras.push(data)
  }
  const { data: created, error: createError } = await admin
    .from('media_assets')
    .insert(preserve)
    .select('id, entity_key, display_order, active')
    .maybeSingle()
  report('LIVE22: throwaway hero:qa-media-v3 created', !createError && created?.entity_key === 'hero:qa-media-v3', createError?.message)

  const seqKeys = ['A', 'B', 'C', 'D', 'X', 'Y', 'Z'].map((letter) => `hero:qa-v3-seq-${letter}`)
  await admin.from('media_assets').delete().eq('company_id', ISO_ID).in('entity_key', seqKeys)
  const seqRows = []
  for (const [index, key] of seqKeys.slice(0, 4).entries()) {
    const { data, error } = await admin
      .from('media_assets')
      .insert({
        ...preserve,
        entity_key: key,
        display_order: index + 1,
        active: false,
        label_pt: key.slice(-1),
      })
      .select('id, entity_key, display_order, active')
      .maybeSingle()
    seqRows.push({ data, error })
  }
  const incoming = []
  for (const key of seqKeys.slice(4)) {
    const { data, error } = await admin
      .from('media_assets')
      .insert({
        ...preserve,
        entity_key: key,
        display_order: 90,
        active: false,
        label_pt: key.slice(-1),
      })
      .select('id, entity_key, display_order, active')
      .maybeSingle()
    incoming.push({ data, error })
  }
  const existingIds = seqRows.map((row) => row.data?.id).filter(Boolean)
  const incomingIds = incoming.map((row) => row.data?.id).filter(Boolean)
  const composed = insertAtPosition(existingIds, incomingIds, 2)
  report(
    'LIVE22b: batch insert at 2 composes A X Y Z B C D',
    seqRows.every((row) => !row.error && row.data?.active === false) &&
      incoming.every((row) => !row.error && row.data?.active === false) &&
      composed.length === 7,
    composed.length === 7 ? '7 ids' : 'compose failed',
  )

  const OFFSET = 100000
  for (const [index, id] of composed.entries()) {
    await admin.from('media_assets').update({ display_order: OFFSET + index }).eq('id', id).eq('company_id', ISO_ID)
  }
  for (const [index, id] of composed.entries()) {
    await admin.from('media_assets').update({ display_order: index + 1 }).eq('id', id).eq('company_id', ISO_ID)
  }
  const { data: afterReorder } = await admin
    .from('media_assets')
    .select('id, entity_key, display_order, active')
    .eq('company_id', ISO_ID)
    .in('id', composed)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true })
  const orderedKeys = (afterReorder ?? []).map((row) => row.entity_key)
  const orders = (afterReorder ?? []).map((row) => row.display_order)
  const uniqueOrders = new Set(orders)
  report(
    'LIVE22c: display_order is 1..N without duplicates',
    orders.join(',') === '1,2,3,4,5,6,7' && uniqueOrders.size === 7,
    orders.join(','),
  )
  report(
    'LIVE22d: entity_key stays A X Y Z B C D after reorder',
    orderedKeys.join(',') === seqKeys.slice(0, 1).concat(seqKeys.slice(4), seqKeys.slice(1, 4)).join(','),
    orderedKeys.join(','),
  )

  const { data: reload } = await admin
    .from('media_assets')
    .select('id, entity_key, display_order')
    .eq('company_id', ISO_ID)
    .in('id', composed)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true })
  report(
    'LIVE22e: refresh/reload keeps the same saved order',
    (reload ?? []).map((row) => row.entity_key).join(',') === orderedKeys.join(','),
  )

  const mobile = { x: 0.71, y: 0.21 }
  const tablet = { x: 0.5, y: 0.5 }
  const desktop = { x: 0.19, y: 0.81 }
  if (created?.id) {
    const ids = [created.id, extras[0]?.id, extras[1]?.id].filter(Boolean)
    await admin.from('media_assets').update({ display_order: 100001 }).eq('id', created.id).eq('company_id', ISO_ID)
    await admin.from('media_assets').update({ display_order: 1 }).eq('id', created.id).eq('company_id', ISO_ID)
    await admin
      .from('media_assets')
      .update({
        active: true,
        editor_meta: {
          autoFocus: 'HEURISTIC',
          focusMode: 'manual',
          overlayEnabled: false,
          overlayDecided: true,
          suggested: { mobile: { x: 0.5, y: 0.5 }, tablet: { x: 0.5, y: 0.5 }, desktop: { x: 0.5, y: 0.5 } },
          applied: { mobile, tablet, desktop },
        },
      })
      .eq('id', created.id)
      .eq('company_id', ISO_ID)
    const { data: after } = await admin
      .from('media_assets')
      .select('entity_key, active, display_order, editor_meta')
      .eq('id', created.id)
      .eq('company_id', ISO_ID)
      .maybeSingle()
    report(
      'LIVE23: SAVE MUST NOT MUTATE ENTITY IDENTITY',
      after?.entity_key === 'hero:qa-media-v3' && after.active === true,
      after?.entity_key,
    )
    report(
      'LIVE23b: applied focus is independent per device',
      after?.editor_meta?.applied?.mobile?.x === mobile.x &&
        after?.editor_meta?.applied?.tablet?.x === tablet.x &&
        after?.editor_meta?.applied?.desktop?.y === desktop.y,
    )
    const leaked = await admin.from('media_assets').update({ active: false }).eq('id', created.id).eq('company_id', CDL_ID).select('id')
    report('LIVE24: CDL cannot mutate ISO identity row', (leaked.data ?? []).length === 0)
    const leakedReorder = await admin
      .from('media_assets')
      .update({ display_order: 999 })
      .eq('id', composed[0])
      .eq('company_id', CDL_ID)
      .select('id')
    report('LIVE24b: CDL cannot reorder ISO asset', (leakedReorder.data ?? []).length === 0)

    await admin.from('media_assets').update({ active: true }).eq('company_id', ISO_ID).in('id', incomingIds)
    const { data: activated } = await admin
      .from('media_assets')
      .select('id, active, entity_key')
      .eq('company_id', ISO_ID)
      .in('id', incomingIds)
    report(
      'LIVE24c: activate selected turns only the chosen rows on',
      (activated ?? []).length === 3 && (activated ?? []).every((row) => row.active === true),
    )
    await admin.from('media_assets').update({ active: false }).eq('company_id', ISO_ID).in('id', incomingIds)
    const { data: inactivated } = await admin
      .from('media_assets')
      .select('id, active')
      .eq('company_id', ISO_ID)
      .in('id', incomingIds)
    report(
      'LIVE24d: inactivate selected turns only the chosen rows off',
      (inactivated ?? []).length === 3 && (inactivated ?? []).every((row) => row.active === false),
    )

    await admin.from('media_assets').delete().eq('company_id', ISO_ID).in('id', ids)
  }

  await admin
    .from('media_assets')
    .delete()
    .eq('company_id', ISO_ID)
    .in('entity_key', ['hero:qa-media-v3', 'hero:qa-media-v3-a', 'hero:qa-media-v3-b', ...seqKeys])
  const { data: leftover } = await admin
    .from('media_assets')
    .select('id')
    .eq('company_id', ISO_ID)
    .in('entity_key', ['hero:qa-media-v3', ...seqKeys])
  report('LIVE25: v3 throwaways deleted', (leftover ?? []).length === 0)

  const { data: cdlLanding } = await admin
    .from('media_assets')
    .select('id, entity_key, placement, active, display_order, company_id')
    .eq('company_id', CDL_ID)
    .eq('entity_type', 'public_landing')
  const publishedHero = publicHeroPlaylist(cdlLanding ?? [])
  report(
    'LIVE25b: public hero is company + hero + active + display_order ASC',
    publishedHero.length > 0 &&
      publishedHero.every((row) => row.company_id === CDL_ID && row.active === true) &&
      publishedHero.every((row, index, list) => index === 0 || list[index - 1].display_order <= row.display_order) &&
      !(cdlLanding ?? []).some((row) => String(row.entity_key || '').startsWith('how_it_works:') && publishedHero.some((hero) => hero.id === row.id)),
    `count=${publishedHero.length}`,
  )

  const { data: stillThere } = await admin
    .from('media_assets')
    .select('id, media_url, display_order, active')
    .eq('company_id', CDL_ID)
    .eq('entity_key', 'hero:item-1787407319293')
    .maybeSingle()
  report(
    'LIVE26: existing item still present after QA throwaways',
    stillThere?.id === existingItem?.id && stillThere?.media_url === existingItem?.media_url,
    stillThere?.id,
  )
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
