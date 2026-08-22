import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { PUBLIC_MEDIA_ENTITY_TYPE, type MediaVariant } from '@/Lib/media/constants'
import { uploadCompanyPublicMedia } from '@/Lib/media/storage'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { id } = await context.params
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'invalid_form' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'missing_file' }, { status: 400 })
  }
  const kind = String(formData.get('kind') || 'media')
  const supabase = getSupabaseServerClient()
  const { data: current, error: loadError } = await supabase
    .from('media_assets')
    .select('id, placement, variant')
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .maybeSingle()
  if (loadError || !current) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  const uploaded = await uploadCompanyPublicMedia({
    companyId,
    placement: current.placement,
    assetId: id,
    variant: (current.variant || 'original') as MediaVariant,
    file,
  })
  if (uploaded.error || !uploaded.publicUrl) {
    const status = uploaded.error === 'file_too_large' || uploaded.error === 'invalid_type' ? 400 : 500
    return Response.json({ error: uploaded.error || 'upload_failed' }, { status })
  }
  const patch =
    kind === 'poster'
      ? { poster_url: uploaded.publicUrl }
      : { media_url: uploaded.publicUrl, storage_path: uploaded.storagePath }
  const { data, error } = await supabase
    .from('media_assets')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: auth.session.appUser?.id ?? auth.session.userId,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .maybeSingle()
  if (error || !data) {
    return Response.json({ error: error?.message || 'update_failed' }, { status: 500 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: auth.session.appUser?.id ?? auth.session.userId,
    action: 'media.replace',
    entityType: 'media_assets',
    entityId: id,
    metadata: { kind, path: uploaded.storagePath },
  })
  return Response.json({ asset: data })
}
