import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/Lib/media/constants'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

const UPDATABLE = [
  'entity_key',
  'media_type',
  'media_url',
  'poster_url',
  'label_pt',
  'label_en',
  'label_es',
  'alt_pt',
  'alt_en',
  'alt_es',
  'title_pt',
  'title_en',
  'title_es',
  'subtitle_pt',
  'subtitle_en',
  'subtitle_es',
  'overlay_enabled',
  'overlay_position',
  'variant',
  'focal_x',
  'focal_y',
  'display_order',
  'status',
] as const

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
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.session.appUser?.id ?? auth.session.userId,
  }
  for (const key of UPDATABLE) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  if (typeof patch.status === 'string') {
    patch.active = patch.status !== 'inactive'
  }
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('media_assets')
    .update(patch)
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .select('*')
    .maybeSingle()
  if (error || !data) {
    return Response.json({ error: error?.message || 'update_failed' }, { status: 404 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: auth.session.appUser?.id ?? auth.session.userId,
    action: patch.status ? 'media.publish' : 'media.update',
    entityType: 'media_assets',
    entityId: id,
    metadata: { keys: Object.keys(patch) },
  })
  return Response.json({ asset: data })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { id } = await context.params
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('media_assets')
    .update({
      active: false,
      status: 'inactive',
      updated_at: new Date().toISOString(),
      updated_by: auth.session.appUser?.id ?? auth.session.userId,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .select('id')
    .maybeSingle()
  if (error || !data) {
    return Response.json({ error: error?.message || 'delete_failed' }, { status: 404 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: auth.session.appUser?.id ?? auth.session.userId,
    action: 'media.delete',
    entityType: 'media_assets',
    entityId: id,
    metadata: { soft: true },
  })
  return Response.json({ ok: true })
}
