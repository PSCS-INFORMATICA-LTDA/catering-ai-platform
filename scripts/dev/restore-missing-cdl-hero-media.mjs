#!/usr/bin/env node
/**
 * DEV-only idempotent restore of CDL Hero media_assets rows whose Git files
 * still exist but whose rows were deleted during earlier QA.
 *
 * Does NOT:
 *   - apply schema migrations
 *   - reupload / delete / change hero:item-1787407319293
 *   - invent placeholder files
 *
 * Target: Supabase DEV yasprgtlqclwsjcshtls only.
 */

import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadDevEnv, assertDevUrl, DEV_REF } from './loadDevEnv.mjs'

const PROD_PROJECT_REF = 'eapwtirhevxrqinytans'
const COMPANY_SLUG = 'cdl'
const ENTITY_TYPE = 'public_landing'
const PRESERVED_KEY = 'hero:item-1787407319293'
const REORDER_OFFSET = 100000

const RESTORE_TARGETS = [
  {
    entityKey: 'hero:cdl-grill-corn-flames',
    fileRel: 'public/cdl/hero/cdl-grill-corn-flames.webp',
    mediaUrl: '/cdl/hero/cdl-grill-corn-flames.webp',
    storagePath: '/cdl/hero/cdl-grill-corn-flames.webp',
    altText: 'Corn, steaks and sausages cooking over grill flames',
    caption: null,
    captionAlign: 'top-left',
    mobilePosition: '42% 52%',
    desktopPosition: '44% 48%',
  },
  {
    entityKey: 'hero:cdl-event-pool-station',
    fileRel: 'public/cdl/hero/cdl-event-pool-station.webp',
    mediaUrl: '/cdl/hero/cdl-event-pool-station.webp',
    storagePath: '/cdl/hero/cdl-event-pool-station.webp',
    altText: 'CDL Brazilian BBQ station under a branded tent beside a luxury pool',
    caption: {
      pt: 'Churrasco brasileiro feito para o seu evento',
      en: 'Brazilian barbecue made for your event',
      es: 'Barbacoa brasileña hecha para tu evento',
    },
    captionAlign: 'top-right',
    mobilePosition: '42% 38%',
    desktopPosition: '44% 36%',
  },
]

function parsePos(value) {
  const [xRaw, yRaw] = String(value).replace(/%/g, '').trim().split(/\s+/)
  const x = Number(xRaw)
  const y = Number(yRaw)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Invalid object-position: ${value}`)
  }
  return { x: x / 100, y: y / 100 }
}

function heuristicEditorMeta(target) {
  const mobile = parsePos(target.mobilePosition)
  const desktop = parsePos(target.desktopPosition)
  const tablet = {
    x: Number(((mobile.x + desktop.x) / 2).toFixed(4)),
    y: Number(((mobile.y + desktop.y) / 2).toFixed(4)),
  }
  const suggested = { mobile, tablet, desktop }
  return {
    autoFocus: 'HEURISTIC',
    focusMode: 'auto',
    overlayEnabled: Boolean(target.caption),
    overlayDecided: Boolean(target.caption),
    overlayPosition: target.captionAlign ?? 'top-left',
    suggested,
    applied: {
      mobile: { ...mobile },
      tablet: { ...tablet },
      desktop: { ...desktop },
    },
  }
}

function matchesHeroPlacement(row) {
  return row?.placement === 'hero' || (row?.placement == null && String(row?.entity_key || '').startsWith('hero:'))
}

function sortHeroRows(rows) {
  return [...rows].sort((a, b) => {
    const orderDelta = Number(a.display_order || 0) - Number(b.display_order || 0)
    if (orderDelta !== 0) return orderDelta
    return String(a.id).localeCompare(String(b.id))
  })
}

function aliasKeys(entityKey) {
  const raw = String(entityKey)
  const unprefixed = raw.replace(/^hero:/, '')
  return [...new Set([raw, unprefixed, `hero:${unprefixed}`])]
}

export async function restoreMissingCdlHeroMedia({ dryRun = false } = {}) {
  const env = loadDevEnv(process.cwd())
  if (env.url.includes(PROD_PROJECT_REF)) {
    throw new Error('PROD REF eapwtirhevxrqinytans detected — aborting.')
  }
  assertDevUrl(env.url)
  if (!env.service) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  for (const target of RESTORE_TARGETS) {
    if (!existsSync(target.fileRel)) {
      if (target.entityKey === 'hero:cdl-event-pool-station') {
        throw new Error('TENDA SOURCE FILE NOT FOUND')
      }
      throw new Error(`SOURCE FILE NOT FOUND: ${target.fileRel}`)
    }
  }

  const supabase = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, slug')
    .eq('slug', COMPANY_SLUG)
    .maybeSingle()
  if (companyError) throw new Error(companyError.message)
  if (!company?.id) throw new Error('CDL company not found')

  const { data: rawRows, error: listError } = await supabase
    .from('media_assets')
    .select(
      'id, company_id, entity_type, entity_key, media_url, storage_path, placement, display_order, active, editor_meta, label_pt, title_pt',
    )
    .eq('company_id', company.id)
    .eq('entity_type', ENTITY_TYPE)
  if (listError) throw new Error(listError.message)

  const allRows = rawRows || []
  const heroRows = allRows.filter(matchesHeroPlacement)
  const byKey = new Map(allRows.map((row) => [row.entity_key, row]))

  const preserved = byKey.get(PRESERVED_KEY)
  if (!preserved) {
    throw new Error(`${PRESERVED_KEY} missing — refuse to restore without the new grill photo`)
  }
  if (preserved.active !== true) {
    throw new Error(`${PRESERVED_KEY} is not active — refuse to mutate it`)
  }

  const actions = []
  let nextOrder = heroRows.reduce((max, row) => Math.max(max, Number(row.display_order || 0)), 0)

  for (const target of RESTORE_TARGETS) {
    const existing = aliasKeys(target.entityKey)
      .map((key) => byKey.get(key))
      .find(Boolean)

    if (existing) {
      if (existing.entity_key !== target.entityKey) {
        actions.push({
          entityKey: target.entityKey,
          action: 'already_present_alias',
          id: existing.id,
          existingKey: existing.entity_key,
        })
        continue
      }
      const patch = {}
      if (existing.active !== true) patch.active = true
      if (!existing.editor_meta) patch.editor_meta = heuristicEditorMeta(target)
      if (existing.placement == null) patch.placement = 'hero'
      if (Object.keys(patch).length === 0) {
        actions.push({ entityKey: target.entityKey, action: 'already_present', id: existing.id })
        continue
      }
      if (!dryRun) {
        const { error } = await supabase.from('media_assets').update(patch).eq('id', existing.id)
        if (error) throw new Error(error.message)
      }
      actions.push({
        entityKey: target.entityKey,
        action: existing.active === true ? 'patched_same_row' : 'reactivated_same_row',
        id: existing.id,
        patch: Object.keys(patch),
      })
      continue
    }

    nextOrder += 1
    const meta = heuristicEditorMeta(target)
    const insertRow = {
      company_id: company.id,
      entity_type: ENTITY_TYPE,
      entity_key: target.entityKey,
      media_type: 'image',
      media_url: target.mediaUrl,
      storage_path: target.storagePath,
      placement: 'hero',
      variant: 'original',
      display_order: nextOrder,
      active: true,
      label_pt: target.altText,
      label_en: target.altText,
      label_es: target.altText,
      alt_pt: target.altText,
      alt_en: target.altText,
      alt_es: target.altText,
      title_pt: target.caption?.pt ?? null,
      title_en: target.caption?.en ?? null,
      title_es: target.caption?.es ?? null,
      editor_meta: meta,
    }
    if (!dryRun) {
      const { data: inserted, error } = await supabase
        .from('media_assets')
        .insert(insertRow)
        .select('id, entity_key, display_order, active, placement')
        .single()
      if (error) throw new Error(error.message)
      byKey.set(target.entityKey, inserted)
      heroRows.push(inserted)
      actions.push({
        entityKey: target.entityKey,
        action: 'inserted',
        id: inserted.id,
        displayOrder: inserted.display_order,
      })
    } else {
      actions.push({ entityKey: target.entityKey, action: 'would_insert', displayOrder: nextOrder })
    }
  }

  const { data: afterRaw, error: afterError } = await supabase
    .from('media_assets')
    .select('id, entity_key, display_order, active, placement, editor_meta')
    .eq('company_id', company.id)
    .eq('entity_type', ENTITY_TYPE)
  if (afterError) throw new Error(afterError.message)

  const afterHero = sortHeroRows((afterRaw || []).filter(matchesHeroPlacement))
  const preservedAfter = afterHero.find((row) => row.entity_key === PRESERVED_KEY)
  if (!preservedAfter) {
    throw new Error(`${PRESERVED_KEY} disappeared during restore`)
  }

  const normalized = [preservedAfter, ...afterHero.filter((row) => row.entity_key !== PRESERVED_KEY)]

  if (!dryRun) {
    for (const [index, row] of normalized.entries()) {
      const { error } = await supabase
        .from('media_assets')
        .update({ display_order: REORDER_OFFSET + index })
        .eq('id', row.id)
        .eq('company_id', company.id)
      if (error) throw new Error(error.message)
    }
    for (const [index, row] of normalized.entries()) {
      const { error } = await supabase
        .from('media_assets')
        .update({ display_order: index + 1 })
        .eq('id', row.id)
        .eq('company_id', company.id)
      if (error) throw new Error(error.message)
    }
  }

  const { data: finalRaw, error: finalError } = await supabase
    .from('media_assets')
    .select('id, entity_key, media_url, storage_path, placement, display_order, active, editor_meta')
    .eq('company_id', company.id)
    .eq('entity_type', ENTITY_TYPE)
  if (finalError) throw new Error(finalError.message)

  const finalHero = sortHeroRows((finalRaw || []).filter(matchesHeroPlacement))
  const orders = finalHero.map((row) => Number(row.display_order))
  const expectedOrders = finalHero.map((_, index) => index + 1)
  if (orders.join(',') !== expectedOrders.join(',')) {
    throw new Error(`Playlist not normalized: ${orders.join(',')}`)
  }
  if (finalHero[0]?.entity_key !== PRESERVED_KEY) {
    throw new Error(`Position 1 is ${finalHero[0]?.entity_key}, expected ${PRESERVED_KEY}`)
  }

  return {
    companyId: company.id,
    supabaseRef: DEV_REF,
    preserved: {
      id: preserved.id,
      entityKey: PRESERVED_KEY,
      active: preserved.active,
      displayOrder: 1,
    },
    actions,
    playlist: finalHero.map((row) => ({
      displayOrder: Number(row.display_order),
      entityKey: row.entity_key,
      active: row.active === true,
      placement: row.placement,
      hasEditorMeta: Boolean(row.editor_meta),
      mediaUrl: row.media_url,
      appliedMobile: row.editor_meta?.applied?.mobile || null,
    })),
  }
}

export { RESTORE_TARGETS, PRESERVED_KEY, matchesHeroPlacement, sortHeroRows, aliasKeys }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  restoreMissingCdlHeroMedia()
    .then((result) => {
      console.log(JSON.stringify({ ok: true, ...result }, null, 2))
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
