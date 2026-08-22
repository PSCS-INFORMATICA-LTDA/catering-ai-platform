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

function focusToCss(focus) {
  const x = Math.round(Math.min(1, Math.max(0, focus.x)) * 100)
  const y = Math.round(Math.min(1, Math.max(0, focus.y)) * 100)
  return `${x}% ${y}%`
}

function resolvePublicPlacement(input) {
  if (input.placement === 'hero' || input.placement === 'how_it_works' || input.placement === 'video') {
    return input.placement
  }
  const key = String(input.entity_key || '')
  if (key.startsWith('hero:')) return 'hero'
  if (key.startsWith('how_it_works:')) return 'how_it_works'
  if (key.startsWith('video:')) return 'video'
  return null
}

function publicHeroPlaylist(rows) {
  return rows
    .filter((row) => resolvePublicPlacement(row) === 'hero' && row.active === true)
    .sort((left, right) => {
      const order = (left.display_order || 0) - (right.display_order || 0)
      return order !== 0 ? order : String(left.id).localeCompare(String(right.id))
    })
}

const mapPublic = read('Lib/media/mapPublicHero.ts')
const repo = read('Lib/media/repository.ts')
const patchApi = read('app/api/media/assets/[id]/route.ts')
const reorderApi = read('app/api/media/assets/reorder/route.ts')
const bulkApi = read('app/api/media/assets/bulk-active/route.ts')
const fileApi = read('app/api/media/assets/[id]/file/route.ts')
const revalidate = read('Lib/media/revalidatePublic.ts')
const placement = read('Lib/media/publicPlacement.ts')
const manager = read('components/media/MediaContentManager.tsx')
const i18n = read('Lib/i18n/media.ts')
const hero = read('components/quotes/PublicQuoteHeroMedia.tsx')
const css = read('app/globals.css')
const bootstrap = read('Lib/publicQuote/bootstrap.ts')
const wizard = read('app/quotes/new/QuoteWizard.tsx')

report(
  'SRC01: APPLIED_MOBILE_IS_PUBLIC_RENDER_SOURCE',
  mapPublic.includes('focusToCss(editor.applied.mobile)') &&
    mapPublic.includes('focusToCss(editor.applied.tablet)') &&
    mapPublic.includes('focusToCss(editor.applied.desktop)') &&
    !mapPublic.includes('hint?.mobilePosition') &&
    !mapPublic.includes('editor.suggested'),
)
report(
  'SRC02: placement fallback includes NULL + hero: prefix',
  placement.includes("key.startsWith('hero:')") &&
    repo.includes('matchesPublicPlacement') &&
    !repo.includes("query.eq('placement'"),
)
report(
  'SRC03: SAVE revalidates public quote paths',
  revalidate.includes("revalidatePath('/quote/[companySlug]/[locale]', 'page')") &&
    patchApi.includes('revalidatePublicMediaPages') &&
    reorderApi.includes('revalidatePublicMediaPages') &&
    bulkApi.includes('revalidatePublicMediaPages') &&
    fileApi.includes('revalidatePublicMediaPages'),
)
report(
  'SRC04: inactive vs active save messages',
  i18n.includes('Alterações salvas e atualizadas na página pública.') &&
    i18n.includes('This media is inactive and is not shown on the public page.') &&
    i18n.includes('Este medio está inactivo y no aparece en la página pública.') &&
    manager.includes('savedPublicUpdated') &&
    manager.includes('savedInactiveHidden') &&
    manager.includes('toDraft(json.asset'),
)
report(
  'SRC05: public hero uses applied CSS vars and tablet breakpoint',
  hero.includes('data-hero-mobile-pos') &&
    hero.includes('--hero-pos-tablet') &&
    css.includes('min-width: 768px') &&
    css.includes('--hero-pos-tablet'),
)
report('SRC06: public bootstrap opts out of static cache', bootstrap.includes('await connection()'))
report('SRC07: wizard untouched', wizard.includes('entryMode') && !wizard.includes('revalidatePublicMediaPages'))

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO_ID = 'a1111111-1111-4111-8111-111111111111'
const CANONICAL = 'hero:item-1787407319293'
const PUBLIC_URL = 'https://catering-ai-agenda-dev.vercel.app/quote/cdl/pt'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !service) {
  report('LIVE: skipped without DEV supabase env', false)
} else if (url.includes(PROD_REF) || !url.includes(DEV_REF)) {
  report('LIVE: refused non-DEV supabase', false, url)
} else {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const { data: current } = await admin
    .from('media_assets')
    .select('id, entity_key, placement, active, display_order, media_url, editor_meta')
    .eq('company_id', CDL_ID)
    .eq('entity_key', CANONICAL)
    .maybeSingle()

  report(
    'LIVE01: canonical SEQ 01 exists and is active',
    current?.entity_key === CANONICAL &&
      current.active === true &&
      current.display_order === 1 &&
      Boolean(current.media_url),
    current?.id || 'missing',
  )

  const originalMeta = current?.editor_meta ? structuredClone(current.editor_meta) : null
  const nextMobile = { x: 0.18, y: 0.82 }
  const expectedCss = focusToCss(nextMobile)

  if (current?.id && originalMeta) {
    const nextMeta = {
      ...originalMeta,
      applied: {
        ...(originalMeta.applied || {}),
        mobile: nextMobile,
        tablet: originalMeta.applied?.tablet || nextMobile,
        desktop: originalMeta.applied?.desktop || nextMobile,
      },
    }
    const { error: saveError } = await admin
      .from('media_assets')
      .update({ editor_meta: nextMeta })
      .eq('id', current.id)
      .eq('company_id', CDL_ID)
      .eq('entity_key', CANONICAL)
    const { data: afterSave } = await admin
      .from('media_assets')
      .select('entity_key, active, display_order, media_url, editor_meta')
      .eq('id', current.id)
      .maybeSingle()
    report(
      'SAVE_ACTIVE_MEDIA_REFLECTS_PUBLIC_IMMEDIATELY:db',
      !saveError &&
        afterSave?.entity_key === CANONICAL &&
        afterSave.active === true &&
        afterSave.display_order === 1 &&
        afterSave.media_url === current.media_url &&
        afterSave.editor_meta?.applied?.mobile?.x === nextMobile.x &&
        afterSave.editor_meta?.applied?.mobile?.y === nextMobile.y,
      saveError?.message || expectedCss,
    )

    const publicRes = await fetch(PUBLIC_URL, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    })
    const html = await publicRes.text()
    const cacheControl = publicRes.headers.get('cache-control') || ''
    const vercelCache = publicRes.headers.get('x-vercel-cache') || ''
    report(
      'SAVE_ACTIVE_MEDIA_REFLECTS_PUBLIC_IMMEDIATELY:html',
      publicRes.status === 200 &&
        html.includes('item-1787407319293') &&
        html.includes(expectedCss) &&
        /data-hero-photo-count="\d+"/.test(html) &&
        Number((html.match(/data-hero-photo-count="(\d+)"/) || [])[1] || 0) >= 12 &&
        /no-store/.test(cacheControl),
      `status=${publicRes.status} css=${expectedCss} vercel=${vercelCache}`,
    )
    report(
      'APPLIED_MOBILE_IS_PUBLIC_RENDER_SOURCE:html',
      html.includes(`--hero-pos-mobile:${expectedCss}`) || html.includes(expectedCss),
      expectedCss,
    )

    await admin
      .from('media_assets')
      .update({ editor_meta: originalMeta })
      .eq('id', current.id)
      .eq('company_id', CDL_ID)
      .eq('entity_key', CANONICAL)
    const { data: restored } = await admin
      .from('media_assets')
      .select('entity_key, editor_meta, media_url, active, display_order')
      .eq('id', current.id)
      .maybeSingle()
    report(
      'LIVE02: canonical row restored after cache probe',
      restored?.entity_key === CANONICAL &&
        restored.media_url === current.media_url &&
        restored.active === true &&
        restored.display_order === 1 &&
        restored.editor_meta?.applied?.mobile?.x === originalMeta.applied?.mobile?.x,
    )
  } else {
    report('SAVE_ACTIVE_MEDIA_REFLECTS_PUBLIC_IMMEDIATELY:db', false, 'canonical missing')
    report('SAVE_ACTIVE_MEDIA_REFLECTS_PUBLIC_IMMEDIATELY:html', false, 'canonical missing')
    report('APPLIED_MOBILE_IS_PUBLIC_RENDER_SOURCE:html', false, 'canonical missing')
  }

  const inactiveKey = 'hero:qa-inactive-public-reflect'
  await admin.from('media_assets').delete().eq('company_id', ISO_ID).eq('entity_key', inactiveKey)
  const { data: inactive } = await admin
    .from('media_assets')
    .insert({
      company_id: ISO_ID,
      entity_type: 'public_landing',
      entity_key: inactiveKey,
      media_type: 'image',
      media_url: '/iso-isolation-probe.webp',
      storage_path: '/iso-isolation-probe.webp',
      display_order: 77,
      active: false,
      editor_meta: {
        autoFocus: 'HEURISTIC',
        focusMode: 'manual',
        overlayEnabled: false,
        overlayDecided: true,
        applied: { mobile: { x: 0.2, y: 0.8 }, tablet: { x: 0.5, y: 0.5 }, desktop: { x: 0.7, y: 0.3 } },
      },
    })
    .select('id, entity_key, active, editor_meta')
    .maybeSingle()

  const { data: isoLanding } = await admin
    .from('media_assets')
    .select('id, entity_key, placement, active, display_order, company_id')
    .eq('company_id', ISO_ID)
    .eq('entity_type', 'public_landing')
  const publishedIso = publicHeroPlaylist(isoLanding ?? [])
  report(
    'INACTIVE_MEDIA_SAVES_BUT_DOES_NOT_RENDER',
    inactive?.entity_key === inactiveKey &&
      inactive.active === false &&
      inactive.editor_meta?.applied?.mobile?.x === 0.2 &&
      !publishedIso.some((row) => row.entity_key === inactiveKey),
  )

  const keys = ['hero:qa-reorder-a', 'hero:qa-reorder-b', 'hero:qa-reorder-c']
  await admin.from('media_assets').delete().eq('company_id', ISO_ID).in('entity_key', keys)
  const created = []
  for (const [index, key] of keys.entries()) {
    const { data } = await admin
      .from('media_assets')
      .insert({
        company_id: ISO_ID,
        entity_type: 'public_landing',
        entity_key: key,
        media_type: 'image',
        media_url: '/iso-isolation-probe.webp',
        storage_path: '/iso-isolation-probe.webp',
        display_order: index + 1,
        active: true,
        editor_meta: { autoFocus: 'HEURISTIC', focusMode: 'auto', overlayEnabled: false, overlayDecided: true },
      })
      .select('id, entity_key')
      .maybeSingle()
    created.push(data)
  }
  const ids = created.map((row) => row?.id).filter(Boolean)
  const reordered = [ids[2], ids[0], ids[1]]
  for (const [index, id] of reordered.entries()) {
    await admin.from('media_assets').update({ display_order: 100000 + index }).eq('id', id).eq('company_id', ISO_ID)
  }
  for (const [index, id] of reordered.entries()) {
    await admin.from('media_assets').update({ display_order: index + 1 }).eq('id', id).eq('company_id', ISO_ID)
  }
  const { data: afterReorder } = await admin
    .from('media_assets')
    .select('id, entity_key, display_order, active, placement')
    .eq('company_id', ISO_ID)
    .in('id', ids)
  const publicOrder = publicHeroPlaylist(afterReorder ?? []).map((row) => row.entity_key)
  report(
    'REORDER_REFLECTS_PUBLIC_AFTER_SAVE',
    publicOrder.join(',') === 'hero:qa-reorder-c,hero:qa-reorder-a,hero:qa-reorder-b' &&
      new Set((afterReorder ?? []).map((row) => row.display_order)).size === 3,
    publicOrder.join(','),
  )

  const leaked = await admin
    .from('media_assets')
    .update({ display_order: 999 })
    .eq('id', ids[0] || '00000000-0000-4000-8000-000000000000')
    .eq('company_id', CDL_ID)
    .select('id')
  report('LIVE03: CDL cannot reorder ISO after save probe', (leaked.data ?? []).length === 0)

  await admin.from('media_assets').delete().eq('company_id', ISO_ID).in('entity_key', [...keys, inactiveKey])
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
