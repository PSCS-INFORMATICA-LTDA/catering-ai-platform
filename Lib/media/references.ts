import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY_PUBLIC_MEDIA_BUCKET, PUBLIC_MEDIA_ENTITY_TYPE } from './constants'

export function isSharedPublicFallbackPath(path: string | null | undefined) {
  const value = path?.trim() || ''
  return value.startsWith('/cdl/') || value.startsWith('assets/branding/')
}

export function isCompanyScopedStoragePath(companyId: string, path: string | null | undefined) {
  const value = path?.trim() || ''
  return value.startsWith(`${companyId}/`)
}

export async function findMediaDeleteBlockers(
  client: SupabaseClient,
  input: {
    companyId: string
    assetId: string
    mediaUrl: string | null
    storagePath: string | null
  },
) {
  const urls = [input.mediaUrl, input.storagePath]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  const blockers: string[] = []
  if (urls.length === 0) return blockers

  const { data: packages } = await client
    .from('packages')
    .select('id')
    .eq('company_id', input.companyId)
    .in('image_url', urls)
    .limit(1)
  if (packages?.length) blockers.push('packages')

  const { data: items } = await client
    .from('catalog_items')
    .select('id')
    .eq('company_id', input.companyId)
    .in('image_url', urls)
    .limit(1)
  if (items?.length) blockers.push('catalog_items')

  const { data: settings } = await client
    .from('company_public_quote_settings')
    .select('company_id')
    .eq('company_id', input.companyId)
    .in('hero_image_url', urls)
    .limit(1)
  if (settings?.length) blockers.push('company_public_quote_settings')

  const { data: siblingUrls } = await client
    .from('media_assets')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .neq('id', input.assetId)
    .in('media_url', urls)
    .limit(1)
  const { data: siblingPaths } = await client
    .from('media_assets')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .neq('id', input.assetId)
    .in('storage_path', urls)
    .limit(1)
  if (siblingUrls?.length || siblingPaths?.length) blockers.push('media_assets')

  return blockers
}

export function canDeleteStorageObject(input: {
  companyId: string
  storagePath: string | null
  sharedBlockers: string[]
}) {
  if (!input.storagePath) return false
  if (isSharedPublicFallbackPath(input.storagePath)) return false
  if (input.sharedBlockers.includes('media_assets')) return false
  if (!isCompanyScopedStoragePath(input.companyId, input.storagePath)) return false
  return true
}

export { COMPANY_PUBLIC_MEDIA_BUCKET }
