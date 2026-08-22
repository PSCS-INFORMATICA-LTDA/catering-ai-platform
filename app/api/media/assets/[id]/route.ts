import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  COMPANY_PUBLIC_MEDIA_BUCKET,
  canDeleteStorageObject,
  findMediaDeleteBlockers,
} from '@/Lib/media/references'
import {
  getCompanyPublicMedia,
  hardDeleteCompanyPublicMedia,
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
    console.error('[media] save failed', { companyId, id, error })
    return Response.json({ error: 'save_failed' }, { status: 400 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: body.active === false ? 'media.unpublish' : 'media.update',
    entityType: 'media_assets',
    entityId: id,
    metadata: { keys: Object.keys(body) },
  })
  return Response.json({ asset })
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.delete')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { id } = await context.params
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const hard = new URL(request.url).searchParams.get('hard') === '1'
  const supabase = getSupabaseServerClient()

  if (!hard) {
    return Response.json({ error: 'hard_delete_required' }, { status: 400 })
  }

  const current = await getCompanyPublicMedia(supabase, companyId, id)
  if (!current.asset) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const blockers = await findMediaDeleteBlockers(supabase, {
    companyId,
    assetId: id,
    mediaUrl: current.asset.media_url,
    storagePath: current.asset.storage_path,
  })
  const unsafe = blockers.filter((item) => item !== 'media_assets')
  if (unsafe.length > 0) {
    return Response.json({ error: 'delete_referenced', blockers: unsafe }, { status: 409 })
  }

  const storagePath = current.asset.storage_path
  const { ok, error } = await hardDeleteCompanyPublicMedia(supabase, companyId, id)
  if (!ok) {
    console.error('[media] hard delete failed', { companyId, id, error })
    return Response.json({ error: 'delete_failed' }, { status: 400 })
  }

  if (
    canDeleteStorageObject({
      companyId,
      storagePath,
      sharedBlockers: blockers,
    })
  ) {
    const removed = await supabase.storage
      .from(COMPANY_PUBLIC_MEDIA_BUCKET)
      .remove([storagePath as string])
    if (removed.error) {
      console.error('[media] storage delete after row delete', removed.error.message)
    }
  }

  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.delete',
    entityType: 'media_assets',
    entityId: id,
    metadata: { soft: false, storagePath, blockers },
  })
  return Response.json({ ok: true, soft: false })
}
