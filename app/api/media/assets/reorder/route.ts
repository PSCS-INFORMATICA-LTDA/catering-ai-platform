import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { reorderCompanyPublicMedia } from '@/Lib/media/repository'
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
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { ok, error } = await reorderCompanyPublicMedia(
    getSupabaseServerClient(),
    companyId,
    ids,
    actor,
  )
  if (!ok) {
    return Response.json({ error: error || 'reorder_failed' }, { status: 500 })
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
