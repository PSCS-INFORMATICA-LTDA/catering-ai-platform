import {
  requireAnyApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { maskPhone } from '@/Lib/notifications/maskPhone'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAnyApiPermission(
    'notification_deliveries.view',
    'notifications.view',
  )
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const eventKey = url.searchParams.get('event_key')
  const status = url.searchParams.get('status')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = getSupabaseServerClient()
    .from('notification_deliveries')
    .select(
      'id, company_id, event_id, recipient_id, channel, provider, template_key, status, provider_message_id, attempt_count, last_error, created_at, sent_at, delivered_at, read_at, failed_at, notification_events(event_key, entity_type, entity_id, payload), notification_recipients(display_name, phone_e164, locale)',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(120)
  if (status) query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const rows = (data ?? [])
    .map((row) => {
      const event = Array.isArray(row.notification_events)
        ? row.notification_events[0]
        : row.notification_events
      const recipient = Array.isArray(row.notification_recipients)
        ? row.notification_recipients[0]
        : row.notification_recipients
      const payload = (event?.payload || {}) as Record<string, unknown>
      return {
        ...row,
        event_key: event?.event_key ?? null,
        entity_type: event?.entity_type ?? null,
        entity_id: event?.entity_id ?? null,
        quote_number: payload.quoteNumber ?? null,
        invoice_number: payload.invoiceNumber ?? null,
        customer_name: payload.customerName ?? null,
        event_name: payload.eventName ?? null,
        amount: payload.amount ?? null,
        recipient_name: recipient?.display_name ?? null,
        phone_masked: maskPhone(recipient?.phone_e164),
        deep_link: payload.deepLinkPath ?? null,
        notification_events: undefined,
        notification_recipients: undefined,
      }
    })
    .filter((row) => !eventKey || row.event_key === eventKey)
  return Response.json({ data: rows })
}
