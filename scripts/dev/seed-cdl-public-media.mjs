#!/usr/bin/env node
/**
 * Import current CDL landing media into media_assets (DEV only).
 * Preserves existing public URLs. Does not rewrite grill photos.
 * Works before or after the additive placement columns exist.
 */
import { createClient } from '@supabase/supabase-js'
import { getCompanyPublicHeroMedia } from '../../Lib/publicQuote/companyPublicHeroMedia.ts'

function encodePublicEntityKey(placement, key) {
  const clean = String(key || '').trim()
  return clean.startsWith(`${placement}:`) ? clean : `${placement}:${clean || 'item'}`
}

function decodePublicEntityKey(entityKey, placementColumn) {
  if (placementColumn) {
    return { placement: placementColumn, key: entityKey || null }
  }
  const raw = String(entityKey || '')
  const match = raw.match(/^(hero|how_it_works|video):/)
  if (!match) return { placement: null, key: raw || null }
  return { placement: match[1], key: raw.slice(match[0].length) || null }
}

function mapMediaAssetRow(row, extended) {
  const decoded = decodePublicEntityKey(row.entity_key, extended ? row.placement : null)
  return {
    ...row,
    placement: decoded.placement,
    entity_key: decoded.key,
  }
}

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO_ID = 'a1111111-1111-4111-8111-111111111111'
const ENTITY = 'public_landing'

function envUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

if (envUrl().includes(PROD_REF)) {
  console.error('REFUSING: PROD supabase')
  process.exit(1)
}
if (!envUrl().includes(DEV_REF)) {
  console.error('REFUSING: not DEV supabase')
  process.exit(1)
}

const apply = process.argv.includes('--apply')
const supabase = createClient(envUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { error: placementProbe } = await supabase
  .from('media_assets')
  .select('placement')
  .limit(1)
const { error: editorProbe } = await supabase
  .from('media_assets')
  .select('editor_meta')
  .limit(1)
const extended = !placementProbe
const hasEditorMeta = !editorProbe

function parseFocusPoint(position) {
  const [x, y] = String(position || '50% 50%')
    .split(/\s+/)
    .map((part) => Number(String(part).replace('%', '')) / 100)
  return {
    x: Number.isFinite(x) ? x : 0.5,
    y: Number.isFinite(y) ? y : 0.5,
  }
}

function editorMetaFromPhoto(photo) {
  const mobile = parseFocusPoint(photo.mobilePosition)
  const desktop = parseFocusPoint(photo.desktopPosition || photo.mobilePosition)
  return {
    autoFocus: 'HEURISTIC',
    focusMode: 'auto',
    overlayEnabled: Boolean(photo.caption),
    overlayDecided: Boolean(photo.caption),
    overlayPosition: photo.captionAlign ?? 'top-left',
    suggested: { mobile, tablet: mobile, desktop },
    applied: { mobile, tablet: mobile, desktop },
  }
}

const { data: existing, error: existingError } = await supabase
  .from('media_assets')
  .select(
    extended
      ? 'id, entity_key, placement'
      : 'id, entity_key',
  )
  .eq('company_id', CDL_ID)
  .eq('entity_type', ENTITY)

if (existingError) {
  console.error('media_assets query failed:', existingError.message)
  process.exit(1)
}

const existingRows = (existing ?? []).map((row) =>
  mapMediaAssetRow(row, extended),
)
const haveHero = new Set(
  existingRows
    .filter((row) => row.placement === 'hero')
    .map((row) => row.entity_key),
)
const haveVideo = existingRows.some(
  (row) => row.placement === 'video' && row.entity_key === 'pt',
)
const haveHow = existingRows.filter((row) => row.placement === 'how_it_works')

const photos = getCompanyPublicHeroMedia('cdl')
const heroRows = photos
  .map((photo, index) => {
    if (haveHero.has(photo.id)) return null
    const base = {
      company_id: CDL_ID,
      entity_type: ENTITY,
      entity_key: extended
        ? photo.id
        : encodePublicEntityKey('hero', photo.id),
      media_type: 'image',
      media_url: photo.src,
      storage_path: photo.src,
      label_pt: photo.alt,
      label_en: photo.alt,
      label_es: photo.alt,
      display_order: index + 1,
      active: true,
    }
    if (!extended) return base
    return {
      ...base,
      alt_pt: photo.alt,
      alt_en: photo.alt,
      alt_es: photo.alt,
      title_pt: photo.caption?.pt ?? null,
      title_en: photo.caption?.en ?? null,
      title_es: photo.caption?.es ?? null,
      placement: 'hero',
      variant: 'original',
      ...(hasEditorMeta ? { editor_meta: editorMetaFromPhoto(photo) } : {}),
    }
  })
  .filter(Boolean)

const howBlocks = [
  {
    key: 'home-service',
    pt: 'Churrasco profissional a domicílio',
    en: 'Professional barbecue at your home',
    es: 'Parrillada profesional a domicilio',
  },
  {
    key: 'brazilian-experience',
    pt: 'Experiência de churrasco brasileiro',
    en: 'Authentic Brazilian barbecue experience',
    es: 'Experiencia auténtica de asado brasileño',
  },
  {
    key: 'full-setup',
    pt: 'Estrutura completa levada ao local',
    en: 'Complete setup brought to your venue',
    es: 'Estructura completa llevada al lugar',
  },
  {
    key: 'live-chef',
    pt: 'Churrasqueiro preparando em tempo real',
    en: 'Grill chef cooking live at the event',
    es: 'Parrillero preparando en tiempo real',
  },
  {
    key: 'since-2017',
    pt: 'Qualidade, higiene e organização desde 2017',
    en: 'Quality, hygiene and organization since 2017',
    es: 'Calidad, higiene y organización desde 2017',
  },
  {
    key: 'buffet',
    pt: 'Serviço em buffet — o convidado se serve',
    en: 'Buffet service — guests serve themselves',
    es: 'Servicio buffet — el invitado se sirve',
  },
]

const howRows = howBlocks
  .filter((block) => !haveHow.some((row) => row.entity_key === block.key))
  .map((block, index) => {
    const base = {
      company_id: CDL_ID,
      entity_type: ENTITY,
      entity_key: extended
        ? block.key
        : encodePublicEntityKey('how_it_works', block.key),
      media_type: 'image',
      media_url: null,
      storage_path: null,
      label_pt: block.pt,
      label_en: block.en,
      label_es: block.es,
      display_order: index + 1,
      active: true,
    }
    if (!extended) return base
    return {
      ...base,
      title_pt: block.pt,
      title_en: block.en,
      title_es: block.es,
      placement: 'how_it_works',
      variant: 'original',
    }
  })

if (!apply) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        extendedColumns: extended,
        heroToInsert: heroRows.length,
        alreadyHero: haveHero.size,
        howToInsert: howRows.length,
        videoMissing: !haveVideo,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

if (heroRows.length) {
  const { error } = await supabase.from('media_assets').insert(heroRows)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}

if (howRows.length) {
  const { error } = await supabase.from('media_assets').insert(howRows)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}

if (!haveVideo) {
  const videoRow = {
    company_id: CDL_ID,
    entity_type: ENTITY,
    entity_key: extended ? 'pt' : encodePublicEntityKey('video', 'pt'),
    media_type: 'video',
    media_url: '/cdl/video/cdl-como-funciona.mp4',
    storage_path: '/cdl/video/cdl-como-funciona-poster.webp',
    label_pt: 'Como funciona',
    label_en: 'How it works',
    label_es: 'Cómo funciona',
    display_order: 1,
    active: true,
  }
  const { error } = await supabase.from('media_assets').insert(
    extended
      ? {
          ...videoRow,
          poster_url: '/cdl/video/cdl-como-funciona-poster.webp',
          placement: 'video',
          variant: 'original',
        }
      : videoRow,
  )
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}

const { data: isoExisting } = await supabase
  .from('media_assets')
  .select('id')
  .eq('company_id', ISO_ID)
  .eq('entity_type', ENTITY)
  .eq('entity_key', extended ? 'iso-probe' : 'hero:iso-probe')
  .maybeSingle()

if (!isoExisting) {
  const isoRow = {
    company_id: ISO_ID,
    entity_type: ENTITY,
    entity_key: extended ? 'iso-probe' : encodePublicEntityKey('hero', 'iso-probe'),
    media_type: 'image',
    media_url: '/iso-isolation-probe.webp',
    storage_path: '/iso-isolation-probe.webp',
    label_pt: 'ISO probe',
    label_en: 'ISO probe',
    label_es: 'ISO probe',
    display_order: 1,
    active: true,
  }
  const { error } = await supabase.from('media_assets').insert(
    extended
      ? {
          ...isoRow,
          placement: 'hero',
          variant: 'original',
        }
      : isoRow,
  )
  if (error) {
    console.error('iso probe:', error.message)
    process.exit(1)
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      extendedColumns: extended,
      insertedHero: heroRows.length,
      insertedHow: howRows.length,
      videoSeeded: !haveVideo,
      isoProbe: !isoExisting,
    },
    null,
    2,
  ),
)
