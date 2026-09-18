import {
  requireApiPermission,
  requireAnyApiPermission,
  requireSessionCompanyId,
} from '@/Lib/auth/requireApi'
import { toE164 } from '@/Lib/notifications/e164'
import { V1_NOTIFICATION_EVENT_KEYS } from '@/Lib/notifications/types'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

const V1_EVENTS = [...V1_NOTIFICATION_EVENT_KEYS]

async function defaultSubscriptions(companyId: string, recipientId: string) {
  const db = getSupabaseServerClient()
  await db.from('notification_subscriptions').upsert(
    V1_EVENTS.map((eventKey) => ({
      company_id: companyId,
      recipient_id: recipientId,
      event_key: eventKey,
      enabled: true,
    })),
    { onConflict: 'company_id,recipient_id,event_key', ignoreDuplicates: true },
  )
}

export async function GET() {
  const auth = await requireAnyApiPermission('notifications.view', 'notification_deliveries.view')
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const companyId = company.companyId
  const db = getSupabaseServerClient()
  const [{ data, error }, { data: subscriptions }] = await Promise.all([
    db
      .from('notification_recipients')
      .select(
        'id, company_id, display_name, person_id, phone_raw, phone_e164, locale, enabled, channel, consent_status, consent_source, consent_at, created_at, updated_at',
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    db
      .from('notification_subscriptions')
      .select('id, recipient_id, event_key, enabled')
      .eq('company_id', companyId),
  ])
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({
    data: (data ?? []).map((row) => ({
      ...row,
      subscriptions: (subscriptions ?? []).filter((item) => item.recipient_id === row.id),
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('notifications.manage')
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const companyId = company.companyId
  const body = (await request.json().catch(() => null)) as {
    displayName?: string
    phone?: string
    locale?: string
    enabled?: boolean
    channel?: string
    personId?: string
    consentStatus?: string
    subscriptions?: Record<string, boolean>
  } | null
  const phoneRaw = String(body?.phone || '').trim()
  const phoneE164 = toE164(phoneRaw)
  if (!phoneE164) {
    return Response.json({ error: 'invalid_phone' }, { status: 400 })
  }
  const locale = body?.locale === 'en' || body?.locale === 'es' ? body.locale : 'pt'
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('notification_recipients')
    .insert({
      company_id: companyId,
      channel: body?.channel === 'whatsapp' ? 'whatsapp' : 'whatsapp',
      display_name: String(body?.displayName || '').trim() || null,
      person_id: body?.personId || null,
      phone_raw: phoneRaw,
      phone_e164: phoneE164,
      locale,
      enabled: body?.enabled !== false,
      consent_status: 'unknown',
    })
    .select('*')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await defaultSubscriptions(companyId, data.id)
  if (body?.subscriptions) {
    await db.from('notification_subscriptions').upsert(
      V1_EVENTS.map((eventKey) => ({
        company_id: companyId,
        recipient_id: data.id,
        event_key: eventKey,
        enabled: body.subscriptions?.[eventKey] !== false,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'company_id,recipient_id,event_key' },
    )
  }
  return Response.json({ data })
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission('notifications.manage')
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const companyId = company.companyId
  const body = (await request.json().catch(() => null)) as {
    id?: string
    enabled?: boolean
    displayName?: string
    phone?: string
    locale?: string
    personId?: string
    confirmConsent?: boolean
    denyConsent?: boolean
    subscriptions?: Record<string, boolean>
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
  if (typeof body.personId === 'string') patch.person_id = body.personId || null
  if (body.confirmConsent === true) {
    patch.consent_status = 'confirmed'
    patch.consent_source = 'operator_recorded'
    patch.consent_at = new Date().toISOString()
  }
  if (body.denyConsent === true) {
    patch.consent_status = 'denied'
    patch.consent_source = 'operator_recorded'
    patch.consent_at = new Date().toISOString()
  }
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('notification_recipients')
    .update(patch)
    .eq('id', body.id)
    .eq('company_id', companyId)
    .select('*')
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'not_found' }, { status: 404 })
  if (body.subscriptions) {
    await db.from('notification_subscriptions').upsert(
      V1_EVENTS.filter((eventKey) => eventKey in body.subscriptions!).map((eventKey) => ({
        company_id: companyId,
        recipient_id: body.id,
        event_key: eventKey,
        enabled: body.subscriptions?.[eventKey] === true,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'company_id,recipient_id,event_key' },
    )
  }
  return Response.json({ data })
}
