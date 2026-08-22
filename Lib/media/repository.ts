import type { SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_MEDIA_ENTITY_TYPE, type MediaPlacement } from './constants'
import {
  mapMediaAssetRow,
  mediaAssetSelect,
  toInsertRow,
  toReorderRow,
  toSoftDisableRow,
  toUpdateRow,
} from './compat'
import { mediaAssetsSchemaIsExtended } from './schema'
import type { PublicMediaAsset } from './types'

function asClient(client: SupabaseClient) {
  return client
}

export async function listCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  placement?: MediaPlacement | null,
  publishedOnly = false,
): Promise<{ assets: PublicMediaAsset[]; error: string | null; extended: boolean }> {
  const supabase = asClient(client)
  const extended = await mediaAssetsSchemaIsExtended(supabase)
  let query = supabase
    .from('media_assets')
    .select(mediaAssetSelect(extended))
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .order('display_order', { ascending: true })

  if (extended && placement) {
    query = query.eq('placement', placement)
  }
  if (publishedOnly) {
    query = query.eq('active', true)
    if (extended) query = query.eq('status', 'active')
  }

  const { data, error } = await query
  if (error) {
    return { assets: [], error: error.message, extended }
  }

  const assets = (data ?? [])
    .map((row) => mapMediaAssetRow(row as unknown as Record<string, unknown>, extended))
    .filter((asset) => !placement || asset.placement === placement)

  return { assets, error: null, extended }
}

export async function insertCompanyPublicMedia(
  client: SupabaseClient,
  input: Record<string, unknown>,
): Promise<{ asset: PublicMediaAsset | null; error: string | null }> {
  const extended = await mediaAssetsSchemaIsExtended(client)
  const { data, error } = await client
    .from('media_assets')
    .insert(toInsertRow(input, extended))
    .select(mediaAssetSelect(extended))
    .maybeSingle()
  if (error || !data) {
    return { asset: null, error: error?.message || 'insert_failed' }
  }
  return {
    asset: mapMediaAssetRow(data as unknown as Record<string, unknown>, extended),
    error: null,
  }
}

export async function getCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
): Promise<{ asset: PublicMediaAsset | null; error: string | null; extended: boolean }> {
  const extended = await mediaAssetsSchemaIsExtended(client)
  const { data, error } = await client
    .from('media_assets')
    .select(mediaAssetSelect(extended))
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .maybeSingle()
  if (error || !data) {
    return { asset: null, error: error?.message || 'not_found', extended }
  }
  return {
    asset: mapMediaAssetRow(data as unknown as Record<string, unknown>, extended),
    error: null,
    extended,
  }
}

export async function updateCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
  body: Record<string, unknown>,
  actor?: string | null,
): Promise<{ asset: PublicMediaAsset | null; error: string | null }> {
  const current = await getCompanyPublicMedia(client, companyId, id)
  if (!current.asset) return { asset: null, error: current.error || 'not_found' }
  const patch = toUpdateRow(body, current.asset, current.extended, actor)
  if (Object.keys(patch).length === 0) {
    return { asset: current.asset, error: null }
  }
  const { data, error } = await client
    .from('media_assets')
    .update(patch)
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .select(mediaAssetSelect(current.extended))
    .maybeSingle()
  if (error) {
    return { asset: null, error: error.message }
  }
  if (!data) {
    return { asset: current.asset, error: null }
  }
  return {
    asset: mapMediaAssetRow(data as unknown as Record<string, unknown>, current.extended),
    error: null,
  }
}

export async function softDisableCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
  actor?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const extended = await mediaAssetsSchemaIsExtended(client)
  const { data, error } = await client
    .from('media_assets')
    .update(toSoftDisableRow(extended, actor))
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .select('id')
    .maybeSingle()
  if (error || !data) {
    return { ok: false, error: error?.message || 'delete_failed' }
  }
  return { ok: true, error: null }
}

export async function hardDeleteCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
): Promise<{ ok: boolean; error: string | null; storagePath: string | null }> {
  const current = await getCompanyPublicMedia(client, companyId, id)
  if (!current.asset) return { ok: false, error: current.error || 'not_found', storagePath: null }
  const { error } = await client
    .from('media_assets')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
  if (error) return { ok: false, error: error.message, storagePath: current.asset.storage_path }
  return { ok: true, error: null, storagePath: current.asset.storage_path }
}

export async function nextCompanyMediaOrder(
  client: SupabaseClient,
  companyId: string,
  placement: MediaPlacement,
) {
  const { assets } = await listCompanyPublicMedia(client, companyId, placement)
  return assets.reduce((max, asset) => Math.max(max, asset.display_order || 0), 0) + 1
}

export async function reorderCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  ids: string[],
  actor?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const extended = await mediaAssetsSchemaIsExtended(client)
  for (const [index, id] of ids.entries()) {
    const { error } = await client
      .from('media_assets')
      .update(toReorderRow(index + 1, extended, actor))
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}
