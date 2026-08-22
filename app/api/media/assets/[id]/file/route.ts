import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import type { MediaPlacement, MediaVariant } from '@/Lib/media/constants'
import { getCompanyPublicMedia, updateCompanyPublicMedia } from '@/Lib/media/repository'
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
  const current = await getCompanyPublicMedia(supabase, companyId, id)
  if (!current.asset || !current.asset.placement) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  const uploaded = await uploadCompanyPublicMedia({
    companyId,
    placement: current.asset.placement as MediaPlacement,
    assetId: id,
    variant: (current.asset.variant || 'original') as MediaVariant,
    file,
  })
  if (uploaded.error || !uploaded.publicUrl) {
    const status =
      uploaded.error === 'file_too_large' || uploaded.error === 'invalid_type'
        ? 400
        : 500
    return Response.json({ error: uploaded.error || 'upload_failed' }, { status })
  }
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const patch =
    kind === 'poster'
      ? { poster_url: uploaded.publicUrl, storage_path: uploaded.publicUrl }
      : { media_url: uploaded.publicUrl, storage_path: uploaded.storagePath }
  const { asset, error } = await updateCompanyPublicMedia(
    supabase,
    companyId,
    id,
    patch,
    actor,
  )
  if (error || !asset) {
    return Response.json({ error: error || 'update_failed' }, { status: 500 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.replace',
    entityType: 'media_assets',
    entityId: id,
    metadata: { kind, path: uploaded.storagePath },
  })
  return Response.json({ asset })
}
