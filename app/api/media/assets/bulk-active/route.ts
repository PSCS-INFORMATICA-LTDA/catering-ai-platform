import { writeAdminAudit } from '@/Lib/auth/session'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { noStoreJson } from '@/Lib/media/batchValidate'
import { bulkSetCompanyPublicMediaActive } from '@/Lib/media/repository'
import { revalidatePublicMediaPages } from '@/Lib/media/revalidatePublic'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: { ids?: string[]; active?: boolean }
  try {
    body = (await request.json()) as { ids?: string[]; active?: boolean }
  } catch {
    return noStoreJson({ error: 'invalid_json' }, 400)
  }
  const ids = (body.ids ?? []).filter((id) => typeof id === 'string')
  if (typeof body.active !== 'boolean' || ids.length === 0) {
    return noStoreJson({ error: 'invalid_bulk_active' }, 400)
  }
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { ok, error, assets } = await bulkSetCompanyPublicMediaActive(
    getSupabaseServerClient(),
    companyId,
    ids,
    body.active,
    actor,
  )
  if (!ok) {
    return noStoreJson({ error: error || 'bulk_active_failed' }, 500)
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: body.active ? 'media.bulk_activate' : 'media.bulk_unpublish',
    entityType: 'media_assets',
    metadata: { ids, active: body.active },
  })
  revalidatePublicMediaPages()
  return noStoreJson({ ok: true, assets })
}
