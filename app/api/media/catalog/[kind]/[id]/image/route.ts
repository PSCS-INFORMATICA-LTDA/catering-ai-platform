import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { uploadAdditionalItemImage } from '@/Lib/additionalItemImageStorage'
import { uploadPackageImage } from '@/Lib/packageImageStorage'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { kind, id } = await context.params
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

  const supabase = getSupabaseServerClient()
  if (kind === 'packages') {
    const { data: pkg } = await supabase
      .from('packages')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!pkg) return Response.json({ error: 'not_found' }, { status: 404 })
    const result = await uploadPackageImage(id, file)
    if (result.error || !result.publicUrl) {
      return Response.json({ error: result.error || 'upload_failed' }, { status: 400 })
    }
    await writeAdminAudit({
      companyId,
      actorUserId: auth.session.appUser?.id ?? auth.session.userId,
      action: 'media.replace',
      entityType: 'packages',
      entityId: id,
      metadata: { field: 'image_url' },
    })
    return Response.json({ imageUrl: result.publicUrl })
  }

  if (kind === 'additionals') {
    const { data: item } = await supabase
      .from('catalog_items')
      .select('id, item_key, company_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!item) return Response.json({ error: 'not_found' }, { status: 404 })
    const result = await uploadAdditionalItemImage(id, file)
    if (result.error || !result.publicUrl) {
      return Response.json({ error: result.error || 'upload_failed' }, { status: 400 })
    }
    await writeAdminAudit({
      companyId,
      actorUserId: auth.session.appUser?.id ?? auth.session.userId,
      action: 'media.replace',
      entityType: 'catalog_items',
      entityId: id,
      metadata: { field: 'image_url' },
    })
    return Response.json({ imageUrl: result.publicUrl })
  }

  return Response.json({ error: 'invalid_kind' }, { status: 400 })
}
