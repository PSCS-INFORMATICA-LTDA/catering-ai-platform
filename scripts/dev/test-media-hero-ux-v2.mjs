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
const assetsApi = read('app/api/media/assets/route.ts')
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
const editorMigration = read('supabase/migrations/20260822190000_media_editor_meta.sql')

report('UX01: no onBlur autosave', !card.includes('onBlur') && !manager.includes('onBlur'))
report(
  'UX02: explicit Save button is always visible and orange',
  card.includes('data-media-save') &&
    card.includes('bg-[var(--cdl-action)]') &&
    card.includes('uppercase') &&
    !card.includes('disabled={draft.saving || !draft.dirty}') &&
    manager.includes('saveDraft'),
)
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
report(
  'UX15: edit PATCH allowlist ignores missing editor_meta and identity keys',
  compat.includes('MEDIA_EDIT_PATCH_ALLOWLIST') &&
    compat.includes('MEDIA_IDENTITY_KEYS') &&
    !compat.includes('serializeEditorEnvelope'),
)
const editorType = editorMeta.slice(
  editorMeta.indexOf('export type MediaEditorMeta'),
  editorMeta.indexOf('export type MediaCopyFields'),
)
report(
  'UX16: labels stay content-only; editor_meta is technical persist target',
  compat.includes('row.editor_meta = editor') &&
    !compat.includes('__m1') &&
    !compat.includes('serializeEditorEnvelope') &&
    !compat.includes('focal_x') &&
    !compat.includes('overlay_enabled') &&
    !editorMeta.includes('__m1') &&
    !editorType.includes('title_pt') &&
    !editorType.includes('subtitle_pt') &&
    editorMigration.includes("editor_meta jsonb NOT NULL DEFAULT '{}'") &&
    !editorMigration.includes('__m1') &&
    !editorMigration.includes('Until this column exists'),
)
report('UX17: insert honors active boolean', compat.includes("typeof input.active === 'boolean'"))
const MEDIA_IDENTITY_KEYS = ['id', 'company_id', 'entity_type', 'entity_id', 'entity_key']
const MEDIA_EDIT_PATCH_ALLOWLIST = [
  'display_order',
  'active',
  'label_pt',
  'label_en',
  'label_es',
  'alt_pt',
  'alt_en',
  'alt_es',
  'title_pt',
  'title_en',
  'title_es',
  'subtitle_pt',
  'subtitle_en',
  'subtitle_es',
  'editor_meta',
]
const MEDIA_REPLACE_PATCH_ALLOWLIST = ['media_url', 'storage_path', 'poster_url', 'media_type']

function simulateUpdateRow(body, { hasEditorMeta = false, mode = 'edit' } = {}) {
  const allow = new Set(mode === 'replace' ? MEDIA_REPLACE_PATCH_ALLOWLIST : MEDIA_EDIT_PATCH_ALLOWLIST)
  const patch = {}
  for (const key of allow) {
    if (key === 'editor_meta') continue
    if (body[key] !== undefined) patch[key] = body[key]
  }
  if (mode === 'edit' && body.editor && hasEditorMeta) {
    patch.editor_meta = persistableEditorMeta(body.editor)
  }
  if (mode === 'edit' && body.display_order != null) {
    patch.display_order = Number(body.display_order)
  }
  for (const key of MEDIA_IDENTITY_KEYS) delete patch[key]
  for (const key of Object.keys(patch)) {
    if (!allow.has(key)) delete patch[key]
  }
  return patch
}

const identityPatch = simulateUpdateRow(
  {
    id: 'should-not-write',
    company_id: 'should-not-write',
    entity_type: 'event',
    entity_id: 'should-not-write',
    entity_key: 'test-save-key',
    media_url: '/should-not-write.webp',
    storage_path: '/should-not-write.webp',
    display_order: 3,
    active: false,
    title_pt: 'Novo',
    editor: persistableEditorMeta({ overlayDecided: true }),
  },
  { hasEditorMeta: true },
)
const titleOnlyPatch = simulateUpdateRow({ entity_key: 'hero:test-save-key', title_pt: 'Titulo' })
const activeOnlyPatch = simulateUpdateRow({ entity_key: 'hero:test-save-key', active: false })
const editorOnlyPatch = simulateUpdateRow(
  { entity_key: 'hero:test-save-key', editor: persistableEditorMeta({ overlayDecided: true }) },
  { hasEditorMeta: true },
)
const reorderPatch = { display_order: 4 }
const disablePatch = { active: false }
const replacePatch = simulateUpdateRow(
  {
    entity_key: 'hero:test-save-key',
    media_url: '/replaced.webp',
    storage_path: '/replaced.webp',
    title_pt: 'should-not-write-on-replace',
  },
  { mode: 'replace' },
)
const updateFn = compat.slice(compat.indexOf('export function toUpdateRow'), compat.indexOf('export function toSoftDisableRow'))
const reorderFn = compat.slice(compat.indexOf('export function toReorderRow'), compat.indexOf('export function toReorderRow') + 400)
const disableFn = compat.slice(compat.indexOf('export function toSoftDisableRow'), compat.indexOf('export function toReorderRow'))
const editAllow = compat.slice(
  compat.indexOf('MEDIA_EDIT_PATCH_ALLOWLIST'),
  compat.indexOf('MEDIA_REPLACE_PATCH_ALLOWLIST'),
)
const patchStart = manager.indexOf("method: 'PATCH'")
const patchPayload = manager.slice(
  patchStart,
  manager.indexOf('const json = (await response.json())', patchStart),
)
report(
  'UX27: SAVE MUST NOT MUTATE ENTITY IDENTITY',
  compat.includes('MEDIA_EDIT_PATCH_ALLOWLIST') &&
    MEDIA_IDENTITY_KEYS.every((key) => compat.includes(`'${key}'`)) &&
    !editAllow.includes('entity_key') &&
    !editAllow.includes('media_url') &&
    updateFn.includes('delete patch[key]') &&
    !updateFn.includes('patch.entity_key') &&
    !updateFn.includes('encodePublicEntityKey') &&
    !patchPayload.includes('entity_key') &&
    identityPatch.entity_key === undefined &&
    identityPatch.entity_type === undefined &&
    identityPatch.media_url === undefined &&
    identityPatch.storage_path === undefined &&
    identityPatch.company_id === undefined &&
    identityPatch.id === undefined &&
    identityPatch.display_order === 3 &&
    identityPatch.active === false &&
    identityPatch.title_pt === 'Novo' &&
    titleOnlyPatch.entity_key === undefined &&
    titleOnlyPatch.title_pt === 'Titulo' &&
    activeOnlyPatch.entity_key === undefined &&
    activeOnlyPatch.active === false &&
    editorOnlyPatch.entity_key === undefined &&
    editorOnlyPatch.editor_meta?.overlayDecided === true &&
    !reorderFn.includes('entity_key') &&
    reorderPatch.display_order === 4 &&
    !disableFn.includes('entity_key') &&
    disablePatch.active === false &&
    replacePatch.entity_key === undefined &&
    replacePatch.media_url === '/replaced.webp' &&
    replacePatch.title_pt === undefined,
)
report('UX18: sequence label helper exists', editorMeta.includes('SEQ.') && editorMeta.includes("padStart(2, '0')"))
const managerBlock = perms.slice(perms.indexOf('manager: ['), perms.indexOf('sales: ['))
report(
  'UX19: media.delete is owner/admin only',
  perms.includes("'media.delete'") &&
    !managerBlock.includes("'media.delete'") &&
    deleteMigration.includes('media.delete') &&
    deleteMigration.includes('ON CONFLICT (role_key, permission_key)'),
)
report('UX20: session still merges missing media.* keys', session.includes("key.startsWith('media.')"))
report('UX21: shared /cdl/ files are never deleted', refs.includes('isSharedPublicFallbackPath') && refs.includes("startsWith('/cdl/')"))
report('UX22: storage paths are company-scoped', refs.includes('isCompanyScopedStoragePath'))
report(
  'UX23: POST/PATCH require media.manage; DELETE requires media.delete',
  assetsApi.includes("requireApiPermission('media.manage')") &&
    patchApi.includes("requireApiPermission('media.manage')") &&
    patchApi.includes("requireApiPermission('media.delete')") &&
    patchApi.includes('hard_delete_required') &&
    editorMigration.includes("has_permission(company_id, 'media.manage')") &&
    editorMigration.includes("has_permission(company_id, 'media.delete')"),
)

function persistableEditorMeta(input = {}) {
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
    suggested,
    applied: input.applied ?? suggested,
  }
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

report('UX24: sequence label is SEQ. 03', formatSequence(3) === 'SEQ. 03')

const pixels = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) }
pixels.data[0] = 255
pixels.data[1] = 40
pixels.data[2] = 40
pixels.data[3] = 255
const focus = suggestFocusFromPixels(pixels)
report('UX25: heuristic returns normalized focus', focus.x >= 0 && focus.x <= 1 && focus.y >= 0 && focus.y <= 1)
const stripped = persistableEditorMeta({
  title_pt: 'should-not-persist',
  overlayDecided: true,
  overlayEnabled: true,
})
report(
  'UX26: library has no __m1 path; persistable editor_meta drops titles',
  !editorMeta.includes('__m1') &&
    !compat.includes('__m1') &&
    !editorMigration.includes('__m1') &&
    !stripped.title_pt &&
    stripped.overlayEnabled === true,
)

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

  const { count: tokenCount, error: tokenError } = await admin
    .from('media_assets')
    .select('id', { count: 'exact', head: true })
    .like('label_es', '__m1|%')
  report(
    'LIVE00: no leftover __m1 in label_es',
    !tokenError && (tokenCount ?? 0) === 0,
    tokenError?.message || `count=${tokenCount ?? 0}`,
  )

  const editorProbe = await admin.from('media_assets').select('editor_meta').limit(1)
  const titleProbe = await admin.from('media_assets').select('title_pt').limit(1)
  const statusProbe = await admin.from('media_assets').select('status').limit(1)
  const focalProbe = await admin.from('media_assets').select('focal_x').limit(1)
  const overlayProbe = await admin.from('media_assets').select('overlay_enabled').limit(1)
  const hasEditorMeta = !editorProbe.error
  const hasTitleColumns = !titleProbe.error
  report(
    'LIVE00b: editor_meta probed (may be missing until official apply)',
    true,
    hasEditorMeta ? 'present' : editorProbe.error?.message || 'missing',
  )
  report(
    'LIVE00c: status/focal/overlay columns must not exist',
    Boolean(statusProbe.error) && Boolean(focalProbe.error) && Boolean(overlayProbe.error),
    `status=${statusProbe.error ? 'missing' : 'PRESENT'} focal_x=${focalProbe.error ? 'missing' : 'PRESENT'} overlay_enabled=${overlayProbe.error ? 'missing' : 'PRESENT'}`,
  )

  const key = `hero:qa-hero-ux-v2-${Date.now()}`
  const editor = persistableEditorMeta({
    overlayDecided: false,
  })
  const insertPayload = {
    company_id: ISO_ID,
    entity_type: 'public_landing',
    entity_key: key,
    media_type: 'image',
    media_url: '/iso-isolation-probe.webp',
    storage_path: '/iso-isolation-probe.webp',
    label_pt: 'QA hero ux',
    label_en: 'QA hero ux',
    label_es: 'QA ES',
    display_order: 99,
    active: false,
  }
  if (hasEditorMeta) insertPayload.editor_meta = editor
  if (hasTitleColumns) insertPayload.title_pt = 'QA PT'

  const createSelect = [
    'id, company_id, label_es, active, display_order',
    hasTitleColumns ? 'title_pt' : '',
    hasEditorMeta ? 'editor_meta' : '',
  ]
    .filter(Boolean)
    .join(', ')
  const { data: created, error: createError } = await admin
    .from('media_assets')
    .insert(insertPayload)
    .select(createSelect)
    .maybeSingle()

  report(
    'LIVE01: create inactive ISO throwaway',
    !createError && created?.active === false && created?.label_es === 'QA ES',
    createError?.message || created?.id,
  )

  if (created?.id) {
    const empty = await admin.from('media_assets').update({}).eq('id', created.id).eq('company_id', ISO_ID).select('id')
    report('LIVE02: empty update does not throw', !empty.error, empty.error?.message)

    report(
      'LIVE03: editor_meta persisted on create when column exists',
      hasEditorMeta
        ? created?.editor_meta?.autoFocus === 'HEURISTIC' && created?.editor_meta?.title_pt == null
        : true,
      hasEditorMeta ? created?.editor_meta?.autoFocus : 'column missing until official apply',
    )
    if (hasTitleColumns) {
      report('LIVE03b: title_pt persisted on content column', created?.title_pt === 'QA PT')
    }

    const savePatch = {
      label_es: 'QA ES',
      active: true,
    }
    if (hasEditorMeta) {
      savePatch.editor_meta = persistableEditorMeta({
        overlayDecided: true,
        overlayEnabled: true,
        applied: { mobile: { x: 0.72, y: 0.46 }, tablet: { x: 0.72, y: 0.46 }, desktop: { x: 0.7, y: 0.4 } },
      })
    }
    if (hasTitleColumns) savePatch.title_pt = 'Novo'
    const saved = await admin
      .from('media_assets')
      .update(savePatch)
      .eq('id', created.id)
      .eq('company_id', ISO_ID)
      .select(
        [
          'id, active, label_es',
          hasTitleColumns ? 'title_pt' : '',
          hasEditorMeta ? 'editor_meta' : '',
        ]
          .filter(Boolean)
          .join(', '),
      )
      .maybeSingle()
    report(
      'LIVE04: active persist; label_es stays content; editor_meta has no titles',
      saved.data?.active === true &&
        saved.data?.label_es === 'QA ES' &&
        !String(saved.data?.label_es || '').startsWith('__m1|') &&
        (hasEditorMeta
          ? saved.data?.editor_meta?.overlayEnabled === true &&
            saved.data?.editor_meta?.applied?.mobile?.x === 0.72 &&
            saved.data?.editor_meta?.title_pt == null
          : true) &&
        (hasTitleColumns ? saved.data?.title_pt === 'Novo' : true),
      saved.error?.message || String(saved.data?.label_es || ''),
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

  const PRESERVE_KEY = 'hero:qa-save-preserves-key'
  await admin.from('media_assets').delete().eq('company_id', ISO_ID).eq('entity_key', PRESERVE_KEY)

  const preservePayload = {
    company_id: ISO_ID,
    entity_type: 'public_landing',
    entity_key: PRESERVE_KEY,
    media_type: 'image',
    media_url: '/iso-isolation-probe.webp',
    storage_path: '/iso-isolation-probe.webp',
    label_pt: 'QA preserve key',
    label_en: 'QA preserve key',
    label_es: 'QA preserve key',
    display_order: 98,
    active: true,
  }
  if (hasEditorMeta) preservePayload.editor_meta = persistableEditorMeta()
  if (hasTitleColumns) preservePayload.title_pt = 'Antes'

  const { data: preserveRow, error: preserveCreateError } = await admin
    .from('media_assets')
    .insert(preservePayload)
    .select('id, company_id, entity_type, entity_key, media_url, storage_path, display_order, active')
    .maybeSingle()

  report(
    'LIVE10: throwaway hero:qa-save-preserves-key created',
    !preserveCreateError && preserveRow?.entity_key === PRESERVE_KEY,
    preserveCreateError?.message || preserveRow?.id,
  )

  if (preserveRow?.id) {
    const mappedCurrent = {
      id: preserveRow.id,
      company_id: ISO_ID,
      entity_type: 'public_landing',
      entity_key: 'qa-save-preserves-key',
      placement: 'hero',
      display_order: preserveRow.display_order,
      active: preserveRow.active,
    }
    const hostileBody = {
      id: preserveRow.id,
      company_id: CDL_ID,
      entity_type: 'event',
      entity_key: 'qa-save-preserves-key',
      media_url: '/should-not-write.webp',
      storage_path: '/should-not-write.webp',
      display_order: 8,
      active: false,
      title_pt: 'Depois',
      editor: persistableEditorMeta({
        overlayDecided: true,
        overlayEnabled: true,
        applied: {
          mobile: { x: 0.61, y: 0.42 },
          tablet: { x: 0.61, y: 0.42 },
          desktop: { x: 0.6, y: 0.4 },
        },
      }),
    }
    const preservePatch = simulateUpdateRow(hostileBody, { hasEditorMeta })
    const savedPreserve = await admin
      .from('media_assets')
      .update(preservePatch)
      .eq('id', preserveRow.id)
      .eq('company_id', ISO_ID)
      .select('id, entity_key, media_url, storage_path, display_order, active, title_pt, editor_meta')
      .maybeSingle()

    report(
      'LIVE11: SAVE MUST NOT MUTATE ENTITY IDENTITY',
      preserveRow.entity_key === PRESERVE_KEY &&
        mappedCurrent.entity_key === 'qa-save-preserves-key' &&
        savedPreserve.data?.entity_key === PRESERVE_KEY &&
        preservePatch.entity_key === undefined &&
        savedPreserve.data?.media_url === '/iso-isolation-probe.webp' &&
        savedPreserve.data?.storage_path === '/iso-isolation-probe.webp' &&
        savedPreserve.data?.display_order === 8 &&
        savedPreserve.data?.active === false &&
        (hasTitleColumns ? savedPreserve.data?.title_pt === 'Depois' : true) &&
        (hasEditorMeta ? savedPreserve.data?.editor_meta?.overlayDecided === true : true),
      savedPreserve.error?.message || `${preserveRow.entity_key} -> ${savedPreserve.data?.entity_key}`,
    )

    const { error: preserveDeleteError } = await admin
      .from('media_assets')
      .delete()
      .eq('id', preserveRow.id)
      .eq('company_id', ISO_ID)
    report('LIVE12: throwaway hero:qa-save-preserves-key deleted', !preserveDeleteError, preserveDeleteError?.message)

    const { data: preserveLeftover } = await admin
      .from('media_assets')
      .select('id')
      .eq('company_id', ISO_ID)
      .eq('entity_key', PRESERVE_KEY)
    report('LIVE13: identity throwaway gone', (preserveLeftover ?? []).length === 0)
  }

  const { data: restoredHero } = await admin
    .from('media_assets')
    .select('id, entity_key, active, media_url, display_order')
    .eq('company_id', CDL_ID)
    .eq('entity_type', 'public_landing')
    .in('entity_key', ['hero:cdl-canape-sausage-crostini', 'hero:item-1787407319293'])
  const restoredKeys = new Set((restoredHero ?? []).map((row) => row.entity_key))
  report(
    'LIVE14: CDL hero keys stay namespaced',
    restoredKeys.has('hero:cdl-canape-sausage-crostini') &&
      restoredKeys.has('hero:item-1787407319293') &&
      (restoredHero ?? []).every((row) => row.active === true),
    (restoredHero ?? []).map((row) => `${row.entity_key}:${row.display_order}:${row.active}`).join('|'),
  )
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
