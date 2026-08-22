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
import {
  composeReorderIds,
  MEDIA_REORDER_OFFSET,
  newPublicEntityKey,
  sortByCanonicalOrder,
} from './playlist'
import { matchesPublicPlacement } from './publicPlacement'
import { detectMediaSchema } from './schema'
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
  const schema = await detectMediaSchema(supabase)
  let query = supabase
    .from('media_assets')
    .select(mediaAssetSelect(schema))
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true })

  // placement may still be null until the DEV backfill is applied.
  // Decode from entity_key, filter in memory, then sort by display_order ASC.
  if (publishedOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) {
    return { assets: [], error: error.message, extended: schema.extended }
  }

  const assets = sortByCanonicalOrder(
    (data ?? [])
      .filter((row) => {
        if (!placement) return true
        return matchesPublicPlacement(
          row as { placement?: unknown; entity_key?: unknown },
          placement,
        )
      })
      .map((row) => mapMediaAssetRow(row as unknown as Record<string, unknown>, schema)),
  )

  return { assets, error: null, extended: schema.extended }
}

export async function insertCompanyPublicMedia(
  client: SupabaseClient,
  input: Record<string, unknown>,
): Promise<{ asset: PublicMediaAsset | null; error: string | null }> {
  const schema = await detectMediaSchema(client)
  const placement = String(input.placement || '') as MediaPlacement
  const { data, error } = await client
    .from('media_assets')
    .insert(
      toInsertRow(
        {
          ...input,
          entity_key:
            typeof input.entity_key === 'string' && input.entity_key.trim()
              ? input.entity_key
              : newPublicEntityKey(placement),
        },
        schema,
      ),
    )
    .select(mediaAssetSelect(schema))
    .maybeSingle()
  if (error || !data) {
    return { asset: null, error: error?.message || 'insert_failed' }
  }
  return {
    asset: mapMediaAssetRow(data as unknown as Record<string, unknown>, schema),
    error: null,
  }
}

export async function getCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
): Promise<{ asset: PublicMediaAsset | null; error: string | null; extended: boolean }> {
  const schema = await detectMediaSchema(client)
  const { data, error } = await client
    .from('media_assets')
    .select(mediaAssetSelect(schema))
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .maybeSingle()
  if (error || !data) {
    return { asset: null, error: error?.message || 'not_found', extended: schema.extended }
  }
  return {
    asset: mapMediaAssetRow(data as unknown as Record<string, unknown>, schema),
    error: null,
    extended: schema.extended,
  }
}

export async function updateCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
  body: Record<string, unknown>,
  actor?: string | null,
  mode: 'edit' | 'replace' = 'edit',
): Promise<{ asset: PublicMediaAsset | null; error: string | null }> {
  const schema = await detectMediaSchema(client)
  const current = await getCompanyPublicMedia(client, companyId, id)
  if (!current.asset) return { asset: null, error: current.error || 'not_found' }
  const patch = toUpdateRow(body, current.asset, schema, actor, mode)
  if (Object.keys(patch).length === 0) {
    return { asset: current.asset, error: null }
  }
  const { data, error } = await client
    .from('media_assets')
    .update(patch)
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .select(mediaAssetSelect(schema))
    .maybeSingle()
  if (error) {
    return { asset: null, error: error.message }
  }
  if (!data) {
    return { asset: current.asset, error: null }
  }
  return {
    asset: mapMediaAssetRow(data as unknown as Record<string, unknown>, schema),
    error: null,
  }
}

export async function softDisableCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  id: string,
  actor?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const schema = await detectMediaSchema(client)
  const { data, error } = await client
    .from('media_assets')
    .update(toSoftDisableRow(schema, actor))
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

async function writeDisplayOrders(
  client: SupabaseClient,
  companyId: string,
  ids: string[],
  startAt: number,
  schema: Awaited<ReturnType<typeof detectMediaSchema>>,
  actor?: string | null,
) {
  for (const [index, id] of ids.entries()) {
    const { error } = await client
      .from('media_assets')
      .update(toReorderRow(startAt + index, schema, actor))
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    if (error) return error.message
  }
  return null
}

export async function reorderCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  ids: string[],
  actor?: string | null,
  placement?: MediaPlacement | null,
): Promise<{ ok: boolean; error: string | null; assets: PublicMediaAsset[] }> {
  const scoped = placement
    ? await listCompanyPublicMedia(client, companyId, placement)
    : await listCompanyPublicMedia(client, companyId)
  if (scoped.error) return { ok: false, error: scoped.error, assets: [] }
  const composed = composeReorderIds(
    scoped.assets.map((asset) => asset.id),
    ids,
  )
  if (composed.error || composed.ids.length === 0) {
    return { ok: false, error: composed.error || 'missing_ids', assets: scoped.assets }
  }
  const schema = await detectMediaSchema(client)
  const first = await writeDisplayOrders(
    client,
    companyId,
    composed.ids,
    MEDIA_REORDER_OFFSET,
    schema,
    actor,
  )
  if (first) return { ok: false, error: first, assets: scoped.assets }
  const second = await writeDisplayOrders(client, companyId, composed.ids, 1, schema, actor)
  if (second) return { ok: false, error: second, assets: scoped.assets }
  const next = placement
    ? await listCompanyPublicMedia(client, companyId, placement)
    : await listCompanyPublicMedia(client, companyId)
  return { ok: !next.error, error: next.error, assets: next.assets }
}

export async function normalizeCompanyPublicMedia(
  client: SupabaseClient,
  companyId: string,
  placement: MediaPlacement,
  actor?: string | null,
) {
  const current = await listCompanyPublicMedia(client, companyId, placement)
  if (current.error) return { ok: false, error: current.error, assets: [] as PublicMediaAsset[] }
  return reorderCompanyPublicMedia(
    client,
    companyId,
    current.assets.map((asset) => asset.id),
    actor,
    placement,
  )
}

export async function bulkSetCompanyPublicMediaActive(
  client: SupabaseClient,
  companyId: string,
  ids: string[],
  active: boolean,
  actor?: string | null,
) {
  const schema = await detectMediaSchema(client)
  const unique = ids.filter((id, index, list) => id && list.indexOf(id) === index)
  if (unique.length === 0) return { ok: false, error: 'missing_ids', assets: [] as PublicMediaAsset[] }
  const patch = {
    active,
    ...(schema.extended
      ? { updated_at: new Date().toISOString(), updated_by: actor ?? null }
      : {}),
  }
  const { error } = await client
    .from('media_assets')
    .update(patch)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .in('id', unique)
  if (error) return { ok: false, error: error.message, assets: [] }
  const listed = await listCompanyPublicMedia(client, companyId)
  return {
    ok: true,
    error: null,
    assets: listed.assets.filter((asset) => unique.includes(asset.id)),
  }
}
