import { requireApiPermission } from '@/Lib/auth/requireApi'
import { loadMergedDictionary } from '@/Lib/dictionary/loadServerCatalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiPermission('data_dictionary.view')
  if (!auth.ok) return auth.response

  try {
    const catalog = await loadMergedDictionary()
    return Response.json(
      { data: catalog },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'dictionary_load_failed' },
      { status: 500 },
    )
  }
}
