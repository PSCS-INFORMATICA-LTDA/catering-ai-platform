import {
  requireApiPermission,
  requireAnyApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { toE164 } from '@/Lib/notifications/e164'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAnyApiPermission('notifications.view', 'notification_deliveries.view')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await getSupabaseServerClient()
    .from('notification_recipients')
    .select(
      'id, company_id, event_key, channel, display_name, person_id, phone_raw, phone_e164, locale, enabled, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('notifications.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => null)) as {
    displayName?: string
    phone?: string
    locale?: string
    enabled?: boolean
    eventKey?: string
    channel?: string
  } | null
  const phoneRaw = String(body?.phone || '').trim()
  const phoneE164 = toE164(phoneRaw)
  if (!phoneE164) {
    return Response.json({ error: 'invalid_phone' }, { status: 400 })
  }
  const locale = body?.locale === 'en' || body?.locale === 'es' ? body.locale : 'pt'
  const { data, error } = await getSupabaseServerClient()
    .from('notification_recipients')
    .insert({
      company_id: companyId,
      event_key: body?.eventKey === 'quote.created' ? 'quote.created' : 'quote.created',
      channel: body?.channel === 'whatsapp' ? 'whatsapp' : 'whatsapp',
      display_name: String(body?.displayName || '').trim() || null,
      phone_raw: phoneRaw,
      phone_e164: phoneE164,
      locale,
      enabled: body?.enabled !== false,
    })
    .select('*')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission('notifications.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => null)) as {
    id?: string
    enabled?: boolean
    displayName?: string
    phone?: string
    locale?: string
  } | null
  if (!body?.id) return Response.json({ error: 'id_required' }, { status: 400 })
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.displayName === 'string') patch.display_name = body.displayName.trim() || null
  if (typeof body.phone === 'string') {
    const phoneE164 = toE164(body.phone)
    if (!phoneE164) return Response.json({ error: 'invalid_phone' }, { status: 400 })
    patch.phone_raw = body.phone.trim()
    patch.phone_e164 = phoneE164
  }
  if (body.locale === 'pt' || body.locale === 'en' || body.locale === 'es') {
    patch.locale = body.locale
  }
  const { data, error } = await getSupabaseServerClient()
    .from('notification_recipients')
    .update(patch)
    .eq('id', body.id)
    .eq('company_id', companyId)
    .select('*')
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ data })
}
