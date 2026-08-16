import { DICTIONARY_ENTITIES } from './entities.ts'
import { mergeDictionaryCatalog } from './mergeCatalog.ts'
import { fetchPhysicalSchema } from './physicalSchema.ts'
import type { MergedDictionary } from './types.ts'

export function dictionaryBootstrapTables(): string[] {
  return DICTIONARY_ENTITIES.map((e) => e.db_table).filter(
    (t): t is string => Boolean(t),
  )
}

export async function loadMergedDictionary(): Promise<MergedDictionary> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    throw new Error('Supabase env ausente para introspecção do schema.')
  }
  const physical = await fetchPhysicalSchema({
    url,
    serviceKey,
    tables: dictionaryBootstrapTables(),
  })
  return mergeDictionaryCatalog(physical)
}
