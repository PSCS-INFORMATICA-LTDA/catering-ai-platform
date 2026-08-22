#!/usr/bin/env node
/**
 * Import current CDL landing media into media_assets (DEV only).
 * Preserves existing public URLs. Does not rewrite grill photos.
 */
import { createClient } from '@supabase/supabase-js'
import { getCompanyPublicHeroMedia } from '../../Lib/publicQuote/companyPublicHeroMedia.ts'

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
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

function parseFocal(position) {
  const [x, y] = String(position || '50% 50%')
    .split(/\s+/)
    .map((part) => Number(String(part).replace('%', '')) / 100)
  return {
    focal_x: Number.isFinite(x) ? x : 0.5,
    focal_y: Number.isFinite(y) ? y : 0.5,
  }
}

const photos = getCompanyPublicHeroMedia('cdl')
const { data: existing, error: existingError } = await supabase
  .from('media_assets')
  .select('id, entity_key')
  .eq('company_id', CDL_ID)
  .eq('entity_type', ENTITY)
  .eq('placement', 'hero')

if (existingError) {
  console.error('media_assets query failed (apply the migration first):', existingError.message)
  process.exit(existingError.message.includes('placement') ? 2 : 1)
}

const have = new Set((existing ?? []).map((row) => row.entity_key))
const rows = photos
  .map((photo, index) => {
    if (have.has(photo.id)) return null
    const focal = parseFocal(photo.mobilePosition)
    return {
      company_id: CDL_ID,
      entity_type: ENTITY,
      entity_key: photo.id,
      media_type: 'image',
      media_url: photo.src,
      storage_path: photo.src,
      label_pt: photo.alt,
      label_en: photo.alt,
      label_es: photo.alt,
      alt_pt: photo.alt,
      alt_en: photo.alt,
      alt_es: photo.alt,
      title_pt: photo.caption?.pt ?? null,
      title_en: photo.caption?.en ?? null,
      title_es: photo.caption?.es ?? null,
      overlay_enabled: Boolean(photo.caption),
      overlay_position: photo.captionAlign ?? null,
      placement: 'hero',
      variant: 'original',
      display_order: index + 1,
      active: true,
      status: 'active',
      ...focal,
    }
  })
  .filter(Boolean)

const videoExisting = await supabase
  .from('media_assets')
  .select('id')
  .eq('company_id', CDL_ID)
  .eq('entity_type', ENTITY)
  .eq('placement', 'video')
  .eq('entity_key', 'pt')
  .maybeSingle()

if (!apply) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        heroToInsert: rows.length,
        alreadyHero: have.size,
        videoMissing: !videoExisting.data,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

if (rows.length) {
  const { error } = await supabase.from('media_assets').insert(rows)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}

if (!videoExisting.data) {
  const { error } = await supabase.from('media_assets').insert({
    company_id: CDL_ID,
    entity_type: ENTITY,
    entity_key: 'pt',
    media_type: 'video',
    media_url: '/cdl/video/cdl-como-funciona.mp4',
    poster_url: '/cdl/video/cdl-como-funciona-poster.webp',
    label_pt: 'Como funciona',
    label_en: 'How it works',
    label_es: 'Cómo funciona',
    placement: 'video',
    variant: 'original',
    display_order: 1,
    active: true,
    status: 'active',
  })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}

console.log(
  JSON.stringify({ ok: true, insertedHero: rows.length, videoSeeded: !videoExisting.data }, null, 2),
)
