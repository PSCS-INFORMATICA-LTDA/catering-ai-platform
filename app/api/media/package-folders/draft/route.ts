import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { noStoreJson } from '@/Lib/media/batchValidate'
import { uploadPackageFolderDraft } from '@/Lib/media/packageFolderDrafts'
import { parseSlotKey } from '@/Lib/media/packageFolderSlots'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return noStoreJson({ error: 'invalid_form' }, 400)
  }
  const file = formData.get('file')
  const rawSlot = String(formData.get('slotKey') || '')
  const parsed = parseSlotKey(rawSlot)
  if (!parsed) return noStoreJson({ error: 'slot_required' }, 400)
  if (!(file instanceof File)) return noStoreJson({ error: 'missing_file' }, 400)
  const { draft, error } = await uploadPackageFolderDraft(getSupabaseServerClient(), {
    packageKey: parsed.packageKey,
    locale: parsed.locale,
    file,
  })
  if (error || !draft) {
    return noStoreJson({ error: error || 'upload_failed' }, 400)
  }
  await writeAdminAudit({
    companyId: resolveAuthorizedCompanyId(auth.session),
    actorUserId: auth.session.appUser?.id ?? auth.session.userId,
    action: 'media.upload',
    entityType: 'package_folder_draft',
    entityId: draft.path,
    metadata: {
      slotKey: draft.slotKey,
      locale: draft.locale,
      published: false,
    },
  })
  return noStoreJson({ draft, published: false })
}
