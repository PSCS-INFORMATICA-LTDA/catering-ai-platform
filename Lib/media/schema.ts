import type { SupabaseClient } from '@supabase/supabase-js'

let extendedCache: boolean | null = null

export async function mediaAssetsSchemaIsExtended(
  client: SupabaseClient,
): Promise<boolean> {
  if (extendedCache != null) return extendedCache
  const { error } = await client.from('media_assets').select('placement').limit(1)
  extendedCache = !error
  return extendedCache
}

export function resetMediaAssetsSchemaCache() {
  extendedCache = null
}
