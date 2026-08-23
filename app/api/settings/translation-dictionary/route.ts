import { requireApiPermission } from '@/Lib/auth/requireApi'
import { buildTranslationRegistry } from '@/Lib/i18n/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiPermission('translation_dictionary.view')
  if (!auth.ok) return auth.response

  const data = buildTranslationRegistry()
  return Response.json(
    { data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
