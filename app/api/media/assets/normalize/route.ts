import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { noStoreJson } from '@/Lib/media/batchValidate'
import { MEDIA_PLACEMENTS, type MediaPlacement } from '@/Lib/media/constants'
import { normalizeCompanyPublicMedia } from '@/Lib/media/repository'
import { revalidatePublicMediaPages } from '@/Lib/media/revalidatePublic'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: { placement?: string }
  try {
    body = (await request.json()) as { placement?: string }
  } catch {
    return noStoreJson({ error: 'invalid_json' }, 400)
  }
  const placement = String(body.placement || '')
  if (!MEDIA_PLACEMENTS.includes(placement as MediaPlacement)) {
    return noStoreJson({ error: 'invalid_placement' }, 400)
  }
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { ok, error, assets } = await normalizeCompanyPublicMedia(
    getSupabaseServerClient(),
    companyId,
    placement as MediaPlacement,
    actor,
  )
  if (!ok) {
    return noStoreJson({ error: error || 'normalize_failed' }, 500)
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.normalize',
    entityType: 'media_assets',
    metadata: { placement },
  })
  revalidatePublicMediaPages()
  return noStoreJson({ ok: true, assets })
}
