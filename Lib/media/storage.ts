import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  ALLOWED_PUBLIC_IMAGE_TYPES,
  ALLOWED_PUBLIC_VIDEO_TYPES,
  COMPANY_PUBLIC_MEDIA_BUCKET,
  MAX_PUBLIC_IMAGE_BYTES,
  MAX_PUBLIC_VIDEO_BYTES,
  type MediaPlacement,
  type MediaVariant,
} from './constants'

function extensionFor(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'video/webm') return 'webm'
  if (file.type === 'video/mp4') return 'mp4'
  return 'jpg'
}

export function validatePublicMediaFile(file: File, kind: 'image' | 'video') {
  if (kind === 'image') {
    if (!ALLOWED_PUBLIC_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return 'invalid_type'
    }
    if (file.size > MAX_PUBLIC_IMAGE_BYTES) return 'file_too_large'
    return null
  }
  if (!ALLOWED_PUBLIC_VIDEO_TYPES.has(file.type.toLowerCase())) {
    return 'invalid_type'
  }
  if (file.size > MAX_PUBLIC_VIDEO_BYTES) return 'file_too_large'
  return null
}

export function publicMediaObjectPath(input: {
  companyId: string
  placement: MediaPlacement
  assetId: string
  variant: MediaVariant
  filename: string
}) {
  return `${input.companyId}/public/${input.placement}/${input.assetId}/${input.variant}/${input.filename}`
}

export async function uploadCompanyPublicMedia(input: {
  companyId: string
  placement: MediaPlacement
  assetId: string
  variant: MediaVariant
  file: File
}) {
  const kind = input.file.type.startsWith('video/') ? 'video' : 'image'
  const invalid = validatePublicMediaFile(input.file, kind)
  if (invalid) return { publicUrl: null, storagePath: null, error: invalid }

  const filename = `${Date.now()}.${extensionFor(input.file)}`
  const storagePath = publicMediaObjectPath({
    companyId: input.companyId,
    placement: input.placement,
    assetId: input.assetId,
    variant: input.variant,
    filename,
  })
  const supabase = getSupabaseServerClient()
  const { error } = await supabase.storage
    .from(COMPANY_PUBLIC_MEDIA_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: '3600',
      upsert: true,
      contentType: input.file.type,
    })
  if (error) {
    return { publicUrl: null, storagePath: null, error: error.message }
  }
  const { data } = supabase.storage
    .from(COMPANY_PUBLIC_MEDIA_BUCKET)
    .getPublicUrl(storagePath)
  return {
    publicUrl: data.publicUrl?.trim() || null,
    storagePath,
    error: null,
  }
}
