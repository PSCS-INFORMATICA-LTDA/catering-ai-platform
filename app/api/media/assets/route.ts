import { writeAdminAudit } from '@/Lib/auth/session'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { PUBLIC_MEDIA_ENTITY_TYPE, MEDIA_PLACEMENTS } from '@/Lib/media/constants'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireApiPermission('media.view')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const placement = new URL(request.url).searchParams.get('placement')
  const supabase = getSupabaseServerClient()
  let query = supabase
    .from('media_assets')
    .select(
      'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, poster_url, label_pt, label_en, label_es, alt_pt, alt_en, alt_es, title_pt, title_en, title_es, subtitle_pt, subtitle_en, subtitle_es, overlay_enabled, overlay_position, placement, variant, focal_x, focal_y, display_order, active, status, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .order('display_order', { ascending: true })
  if (placement && MEDIA_PLACEMENTS.includes(placement as (typeof MEDIA_PLACEMENTS)[number])) {
    query = query.eq('placement', placement)
  }
  const { data, error } = await query
  if (error) {
    return Response.json({ error: error.message, assets: [] }, { status: 500 })
  }
  return Response.json({ assets: data ?? [] })
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
  const supabase = getSupabaseServerClient()
  const actor = auth.session.appUser?.id ?? auth.session.userId
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      company_id: companyId,
      entity_type: PUBLIC_MEDIA_ENTITY_TYPE,
      entity_key: typeof body.entity_key === 'string' ? body.entity_key : null,
      media_type: typeof body.media_type === 'string' ? body.media_type : 'image',
      media_url: typeof body.media_url === 'string' ? body.media_url : null,
      poster_url: typeof body.poster_url === 'string' ? body.poster_url : null,
      label_pt: typeof body.label_pt === 'string' ? body.label_pt : null,
      label_en: typeof body.label_en === 'string' ? body.label_en : null,
      label_es: typeof body.label_es === 'string' ? body.label_es : null,
      alt_pt: typeof body.alt_pt === 'string' ? body.alt_pt : null,
      alt_en: typeof body.alt_en === 'string' ? body.alt_en : null,
      alt_es: typeof body.alt_es === 'string' ? body.alt_es : null,
      title_pt: typeof body.title_pt === 'string' ? body.title_pt : null,
      title_en: typeof body.title_en === 'string' ? body.title_en : null,
      title_es: typeof body.title_es === 'string' ? body.title_es : null,
      subtitle_pt: typeof body.subtitle_pt === 'string' ? body.subtitle_pt : null,
      subtitle_en: typeof body.subtitle_en === 'string' ? body.subtitle_en : null,
      subtitle_es: typeof body.subtitle_es === 'string' ? body.subtitle_es : null,
      overlay_enabled: body.overlay_enabled === true,
      overlay_position:
        typeof body.overlay_position === 'string' ? body.overlay_position : null,
      placement,
      variant: typeof body.variant === 'string' ? body.variant : 'original',
      focal_x: body.focal_x == null ? null : Number(body.focal_x),
      focal_y: body.focal_y == null ? null : Number(body.focal_y),
      display_order: Number(body.display_order ?? 1),
      active: body.status !== 'inactive',
      status: typeof body.status === 'string' ? body.status : 'draft',
      created_by: actor,
      updated_by: actor,
    })
    .select('*')
    .maybeSingle()
  if (error || !data) {
    return Response.json({ error: error?.message || 'insert_failed' }, { status: 500 })
  }
  await writeAdminAudit({
    companyId,
    actorUserId: actor,
    action: 'media.upload',
    entityType: 'media_assets',
    entityId: data.id as string,
    metadata: { placement, entity_key: data.entity_key },
  })
  return Response.json({ asset: data })
}
