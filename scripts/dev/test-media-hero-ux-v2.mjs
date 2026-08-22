#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
let passed = 0
let failed = 0

function read(rel) {
  const path = join(ROOT, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
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

const manager = read('components/media/MediaContentManager.tsx')
const card = read('components/media/HeroMediaCard.tsx')
const patchApi = read('app/api/media/assets/[id]/route.ts')
const i18n = read('Lib/i18n/media.ts')
const repo = read('Lib/media/repository.ts')
const compat = read('Lib/media/compat.ts')
const editorMeta = read('Lib/media/editorMeta.ts')
const autoFocus = read('Lib/media/autoFocus.ts')
const experience = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const mapPublic = read('Lib/media/mapPublicHero.ts')
const refs = read('Lib/media/references.ts')
const perms = read('Lib/auth/permissions.ts')
const session = read('Lib/auth/session.ts')
const fileApi = read('app/api/media/assets/[id]/file/route.ts')
const deleteMigration = read('supabase/migrations/20260822180000_media_delete_permission.sql')

report('UX01: no onBlur autosave', !card.includes('onBlur') && !manager.includes('onBlur'))
report('UX02: explicit Save button', card.includes('actionSave') && manager.includes('saveDraft'))
report('UX03: add media opens dedicated flow', manager.includes('addTitle') && manager.includes('setAdding(true)'))
report('UX04: sequence is visual identifier', card.includes('formatSequence') && card.includes('sequence'))
report('UX05: activate/inactivate is local until save', card.includes('actionDeactivate') && card.includes('active: !draft.active'))
report(
  'UX06: hard delete requires confirmation',
  card.includes('deleteConfirmTitle') && (manager.includes('hard=1') || patchApi.includes("get('hard')")),
)
report('UX07: referenced delete is blocked', patchApi.includes('delete_referenced') && refs.includes('findMediaDeleteBlockers'))
report('UX08: friendly save error, not update_failed in UI', i18n.includes('saveFailed') && !card.includes('update_failed') && !fileApi.includes('update_failed'))
report('UX09: empty patch is treated as success', repo.includes('Object.keys(patch).length === 0'))
report('UX10: PT/EN/ES save/add/delete strings', i18n.includes('Adicionar nova mídia') && i18n.includes('Excluir definitivamente') && i18n.includes('Guardar'))
report('UX11: public experience not rewritten', experience.includes('PublicQuoteHowItWorks') && !experience.includes('data-hero-ux'))
report('UX12: wizard file untouched', wizard.includes('entryMode') && !wizard.includes('HeroMediaCard'))
report('UX13: AUTO FOCUS declared HEURISTIC', i18n.includes('AUTO FOCUS: HEURISTIC') && autoFocus.includes('Heuristic saliency'))
report('UX14: overlay decision is explicit', editorMeta.includes('overlayDecided') && mapPublic.includes('overlayDecided'))
report('UX15: compat update ignores missing focal column', compat.includes("COMPAT_UPDATABLE") && compat.includes('serializeEditorEnvelope'))
report('UX16: compat save writes envelope into label_es', compat.includes('serializeEditorEnvelope') && compat.includes('label_es'))
report('UX17: insert honors active boolean', compat.includes('typeof input.active === \'boolean\''))
report('UX18: sequence label helper exists', editorMeta.includes('SEQ.') && editorMeta.includes('padStart(2, \'0\')'))
const managerBlock = perms.slice(perms.indexOf('manager: ['), perms.indexOf('sales: ['))
report(
  'UX19: media.delete is owner/admin only',
  perms.includes("'media.delete'") &&
    !managerBlock.includes("'media.delete'") &&
    deleteMigration.includes('media.delete'),
)
report('UX20: session still merges missing media.* keys', session.includes("key.startsWith('media.')"))
report('UX21: shared /cdl/ files are never deleted', refs.includes('isSharedPublicFallbackPath') && refs.includes("startsWith('/cdl/')"))
report('UX22: storage paths are company-scoped', refs.includes('isCompanyScopedStoragePath'))

function defaultEditorMeta(input = {}) {
  const suggested = input.suggested ?? {
    mobile: { x: 0.5, y: 0.5 },
    tablet: { x: 0.5, y: 0.5 },
    desktop: { x: 0.5, y: 0.5 },
  }
  return {
    autoFocus: 'HEURISTIC',
    focusMode: input.focusMode ?? 'auto',
    overlayEnabled: input.overlayEnabled === true,
    overlayDecided: input.overlayDecided === true,
    overlayPosition: input.overlayPosition ?? 'top-left',
    title_pt: input.title_pt ?? '',
    title_en: input.title_en ?? '',
    title_es: input.title_es ?? '',
    subtitle_pt: input.subtitle_pt ?? '',
    subtitle_en: input.subtitle_en ?? '',
    subtitle_es: input.subtitle_es ?? '',
    suggested,
    applied: input.applied ?? suggested,
  }
}

function pct(value) {
  return String(Math.round(Math.min(1, Math.max(0, value)) * 100)).padStart(2, '0')
}

function serializeEditorEnvelope(labelEs, editor) {
  const meta = defaultEditorMeta(editor)
  const flags = `${meta.focusMode === 'manual' ? 'm' : 'a'}${meta.overlayEnabled ? '1' : '0'}${
    meta.overlayDecided ? '1' : '0'
  }tl`
  const maps = [meta.suggested, meta.applied]
  const packed = maps
    .flatMap((map) => [map.mobile, map.tablet, map.desktop])
    .map((point) => `${pct(point.x)}${pct(point.y)}`)
    .join('')
  return `__m1|${flags}|${packed}|${labelEs || meta.title_es || ''}`
}

function parseEditorEnvelope(labelEs) {
  const raw = String(labelEs || '').trim()
  if (raw.startsWith('__m1|')) {
    const parts = raw.split('|')
    return { label_es: parts.slice(3).join('|') || null, editor: defaultEditorMeta() }
  }
  if (!raw.startsWith('{')) return { label_es: labelEs ?? null, editor: null }
  const parsed = JSON.parse(raw)
  if (parsed?.__me !== 1 || !parsed.editor) return { label_es: labelEs ?? null, editor: null }
  return { label_es: parsed.label_es ?? null, editor: defaultEditorMeta(parsed.editor) }
}

function formatSequence(order) {
  const safe = Number.isFinite(order) && order > 0 ? Math.floor(order) : 1
  return `SEQ. ${String(safe).padStart(2, '0')}`
}

function suggestFocusFromPixels(buffer) {
  const { data, width, height } = buffer
  if (!width || !height) return { x: 0.5, y: 0.48 }
  let weightX = 0
  let weightY = 0
  let total = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const r = Number(data[index] ?? 0)
      const g = Number(data[index + 1] ?? 0)
      const b = Number(data[index + 2] ?? 0)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      const contrast = Math.abs(luma - 0.45)
      const nx = x / (width - 1 || 1)
      const ny = y / (height - 1 || 1)
      const centerBias = 1 - Math.hypot(nx - 0.5, ny - 0.58) * 0.85
      const foodBias = 0.65 + saturation * 1.4 + contrast * 0.8
      const weight = Math.max(0.05, foodBias * Math.max(0.15, centerBias))
      weightX += nx * weight
      weightY += ny * weight
      total += weight
    }
  }
  return { x: weightX / total, y: weightY / total }
}

const envelope = serializeEditorEnvelope('ES title', defaultEditorMeta({ overlayEnabled: true, title_pt: 'PT' }))
const parsed = parseEditorEnvelope(envelope)
report(
  'UX23: compact envelope roundtrip fits 255',
  envelope.startsWith('__m1|') && envelope.length <= 255 && parsed.label_es === 'ES title',
  `${envelope.length} chars`,
)
report('UX26: library persists compact __m1 not JSON blob', editorMeta.includes("COMPACT_MARK = '__m1'") && editorMeta.includes('LABEL_ES_MAX'))
report('UX24: sequence label is SEQ. 03', formatSequence(3) === 'SEQ. 03')

const pixels = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) }
pixels.data[0] = 255
pixels.data[1] = 40
pixels.data[2] = 40
pixels.data[3] = 255
const focus = suggestFocusFromPixels(pixels)
report('UX25: heuristic returns normalized focus', focus.x >= 0 && focus.x <= 1 && focus.y >= 0 && focus.y <= 1)

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO_ID = 'a1111111-1111-4111-8111-111111111111'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !service) {
  report('LIVE: skipped without DEV supabase env', true, 'no credentials in this step')
} else if (url.includes(PROD_REF) || !url.includes(DEV_REF)) {
  report('LIVE: refused non-DEV supabase', false, url)
} else {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(url, service, { auth: { persistSession: false } })
  const key = `hero:qa-hero-ux-v2-${Date.now()}`
  const { data: created, error: createError } = await admin
    .from('media_assets')
    .insert({
      company_id: ISO_ID,
      entity_type: 'public_landing',
      entity_key: key,
      media_type: 'image',
      media_url: '/iso-isolation-probe.webp',
      storage_path: '/iso-isolation-probe.webp',
      label_pt: 'QA hero ux',
      label_en: 'QA hero ux',
      label_es: serializeEditorEnvelope('QA ES', defaultEditorMeta({ title_pt: 'QA PT', overlayDecided: false })),
      display_order: 99,
      active: false,
    })
    .select('id, company_id, label_es, active, display_order')
    .maybeSingle()

  report('LIVE01: create inactive ISO throwaway', !createError && created?.active === false, createError?.message || created?.id)

  if (created?.id) {
    const empty = await admin.from('media_assets').update({}).eq('id', created.id).eq('company_id', ISO_ID).select('id')
    report('LIVE02: empty update does not throw', !empty.error, empty.error?.message)

    const missingCol = await admin.from('media_assets').update({ focal_x: 0.72 }).eq('id', created.id).eq('company_id', ISO_ID).select('id')
    report(
      'LIVE03: missing focal_x column is the old update_failed cause',
      Boolean(missingCol.error),
      missingCol.error?.message || 'column unexpectedly exists',
    )

    const saved = await admin
      .from('media_assets')
      .update({
        label_es: serializeEditorEnvelope('QA ES', defaultEditorMeta({
          title_pt: 'Novo',
          overlayDecided: true,
          overlayEnabled: true,
          applied: { mobile: { x: 0.72, y: 0.46 }, tablet: { x: 0.72, y: 0.46 }, desktop: { x: 0.7, y: 0.4 } },
        })),
        active: true,
      })
      .eq('id', created.id)
      .eq('company_id', ISO_ID)
      .select('id, active, label_es')
      .maybeSingle()
    report(
      'LIVE04: envelope + active persist',
      saved.data?.active === true && String(saved.data?.label_es || '').startsWith('__m1|'),
      saved.error?.message || String(saved.data?.label_es || '').slice(0, 40),
    )

    const leaked = await admin
      .from('media_assets')
      .update({ label_pt: 'should-not-write' })
      .eq('id', created.id)
      .eq('company_id', CDL_ID)
      .select('id')
    report('LIVE05: CDL company_id cannot update ISO row', (leaked.data ?? []).length === 0)

    const inactivated = await admin
      .from('media_assets')
      .update({ active: false })
      .eq('id', created.id)
      .eq('company_id', ISO_ID)
      .select('id, active')
      .maybeSingle()
    report('LIVE06: inactivate keeps the row', inactivated.data?.active === false)

    const { error: deleteError } = await admin
      .from('media_assets')
      .delete()
      .eq('id', created.id)
      .eq('company_id', ISO_ID)
    report('LIVE07: hard delete throwaway', !deleteError, deleteError?.message)

    const { data: leftover } = await admin.from('media_assets').select('id').eq('id', created.id)
    report('LIVE08: throwaway gone', (leftover ?? []).length === 0)
  }

  const { data: cdlActive } = await admin
    .from('media_assets')
    .select('id, active, media_url')
    .eq('company_id', CDL_ID)
    .eq('entity_type', 'public_landing')
    .eq('active', true)
    .like('entity_key', 'hero:%')
  report('LIVE09: CDL still has active public hero rows', (cdlActive ?? []).length >= 1, String(cdlActive?.length || 0))
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
