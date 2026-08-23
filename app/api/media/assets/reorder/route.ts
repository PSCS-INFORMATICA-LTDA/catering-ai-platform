import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { noStoreJson } from '@/Lib/media/batchValidate'
import { MEDIA_PLACEMENTS, type MediaPlacement } from '@/Lib/media/constants'
import { reorderCompanyPublicMedia } from '@/Lib/media/repository'
import { revalidatePublicMediaPages } from '@/Lib/media/revalidatePublic'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: { ids?: string[]; placement?: string }
  try {
    body = (await request.json()) as { ids?: string[]; placement?: string }
  } catch {
    return noStoreJson({ error: 'invalid_json' }, 400)
  }
  const ids = (body.ids ?? []).filter((id) => typeof id === 'string')
  if (ids.length === 0) {
    return noStoreJson({ error: 'missing_ids' }, 400)
  }
  const placement = MEDIA_PLACEMENTS.includes(body.placement as MediaPlacement)
    ? (body.placement as MediaPlacement)
    : null
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { ok, error, assets } = await reorderCompanyPublicMedia(
    getSupabaseServerClient(),
    companyId,
    ids,
    actor,
    placement,
  )
  if (!ok) {
    return noStoreJson({ error: error || 'reorder_failed' }, 500)
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.reorder',
    entityType: 'media_assets',
    metadata: { ids, placement },
  })
  revalidatePublicMediaPages()
  return noStoreJson({ ok: true, assets })
}
