import type { SupabaseClient } from '@supabase/supabase-js'

export type MediaSchema = {
  extended: boolean
  hasEditorMeta: boolean
}

let schemaCache: MediaSchema | null = null

export async function detectMediaSchema(
  client: SupabaseClient,
): Promise<MediaSchema> {
  if (schemaCache) return schemaCache
  const [placement, editor] = await Promise.all([
    client.from('media_assets').select('placement').limit(1),
    client.from('media_assets').select('editor_meta').limit(1),
  ])
  schemaCache = {
    extended: !placement.error,
    hasEditorMeta: !editor.error,
  }
  return schemaCache
}

export async function mediaAssetsSchemaIsExtended(
  client: SupabaseClient,
): Promise<boolean> {
  return (await detectMediaSchema(client)).extended
}

export function resetMediaAssetsSchemaCache() {
  schemaCache = null
}
