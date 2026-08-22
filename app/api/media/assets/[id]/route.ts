import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  softDisableCompanyPublicMedia,
  updateCompanyPublicMedia,
} from '@/Lib/media/repository'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { id } = await context.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { asset, error } = await updateCompanyPublicMedia(
    getSupabaseServerClient(),
    companyId,
    id,
    body,
    actor,
  )
  if (error || !asset) {
    return Response.json({ error: error || 'update_failed' }, { status: 404 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: body.status ? 'media.publish' : 'media.update',
    entityType: 'media_assets',
    entityId: id,
    metadata: { keys: Object.keys(body) },
  })
  return Response.json({ asset })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { id } = await context.params
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { ok, error } = await softDisableCompanyPublicMedia(
    getSupabaseServerClient(),
    companyId,
    id,
    actor,
  )
  if (!ok) {
    return Response.json({ error: error || 'delete_failed' }, { status: 404 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.delete',
    entityType: 'media_assets',
    entityId: id,
    metadata: { soft: true },
  })
  return Response.json({ ok: true })
}
