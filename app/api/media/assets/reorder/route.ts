import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/Lib/media/constants'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: { ids?: string[] }
  try {
    body = (await request.json()) as { ids?: string[] }
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }
  const ids = (body.ids ?? []).filter((id) => typeof id === 'string')
  if (ids.length === 0) {
    return Response.json({ error: 'missing_ids' }, { status: 400 })
  }
  const supabase = getSupabaseServerClient()
  const actor = auth.session.appUser?.id ?? auth.session.userId
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from('media_assets')
      .update({
        display_order: index + 1,
        updated_at: new Date().toISOString(),
        updated_by: actor,
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.reorder',
    entityType: 'media_assets',
    metadata: { ids },
  })
  return Response.json({ ok: true })
}
