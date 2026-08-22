import { writeAdminAudit } from '@/Lib/auth/session'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { PUBLIC_MEDIA_ENTITY_TYPE, MEDIA_PLACEMENTS } from '@/Lib/media/constants'
import {
  insertCompanyPublicMedia,
  listCompanyPublicMedia,
} from '@/Lib/media/repository'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireApiPermission('media.view')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const placement = new URL(request.url).searchParams.get('placement')
  const supabase = getSupabaseServerClient()
  const { assets, error } = await listCompanyPublicMedia(
    supabase,
    companyId,
    placement && MEDIA_PLACEMENTS.includes(placement as (typeof MEDIA_PLACEMENTS)[number])
      ? (placement as (typeof MEDIA_PLACEMENTS)[number])
      : null,
  )
  if (error) {
    return Response.json({ error, assets: [] }, { status: 500 })
  }
  return Response.json({ assets })
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('media.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }
  const spoofed = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoofed) return spoofed
  const placement = String(body.placement || '')
  if (!MEDIA_PLACEMENTS.includes(placement as (typeof MEDIA_PLACEMENTS)[number])) {
    return Response.json({ error: 'invalid_placement' }, { status: 400 })
  }
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { asset, error } = await insertCompanyPublicMedia(getSupabaseServerClient(), {
    ...body,
    company_id: companyId,
    entity_type: PUBLIC_MEDIA_ENTITY_TYPE,
    placement,
    created_by: actor,
    updated_by: actor,
  })
  if (error || !asset) {
    return Response.json({ error: error || 'insert_failed' }, { status: 500 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.upload',
    entityType: 'media_assets',
    entityId: asset.id,
    metadata: { placement, entity_key: asset.entity_key },
  })
  return Response.json({ asset })
}
