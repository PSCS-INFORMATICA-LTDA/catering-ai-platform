import { randomUUID } from 'node:crypto'
import { requireApiPermission, requireSessionCompanyId } from '@/Lib/auth/requireApi'
import { enqueueNotificationEvent } from '@/Lib/notifications/enqueueEvent'
import { processNotificationQueue } from '@/Lib/notifications/processDeliveryQueue'
import { recipientSendBlockReason } from '@/Lib/notifications/recipientConsent'
import { V1_NOTIFICATION_EVENT_KEYS } from '@/Lib/notifications/types'
import { environmentBanner } from '@/Lib/notifications/whatsappCopy'
import { quoteDeepLinkPath } from '@/Lib/notifications/env'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('notifications.manage')
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const body = (await request.json().catch(() => null)) as {
    recipientId?: string
    eventKey?: string
  } | null
  const eventKey = V1_NOTIFICATION_EVENT_KEYS.includes(
    body?.eventKey as (typeof V1_NOTIFICATION_EVENT_KEYS)[number],
  )
    ? (body?.eventKey as (typeof V1_NOTIFICATION_EVENT_KEYS)[number])
    : 'quote.created'
  if (!body?.recipientId) {
    return Response.json({ error: 'recipient_required' }, { status: 400 })
  }
  const db = getSupabaseServerClient()
  const { data: recipient } = await db
    .from('notification_recipients')
    .select('id, enabled, locale, display_name, consent_status')
    .eq('id', body.recipientId)
    .eq('company_id', company.companyId)
    .maybeSingle()
  if (!recipient) return Response.json({ error: 'recipient_not_found' }, { status: 404 })
  const block = recipientSendBlockReason(recipient)
  if (block) {
    return Response.json({ error: block }, { status: 409 })
  }

  const entityId = randomUUID()
  const locale = recipient.locale === 'en' || recipient.locale === 'es' ? recipient.locale : 'pt'
  const result = await enqueueNotificationEvent({
    companyId: company.companyId,
    eventKey,
    entityType: 'manual_test',
    entityId,
    payload: {
      eventKey,
      entityType: 'manual_test',
      entityId,
      customerName: recipient.display_name || 'TESTE DEV',
      quoteNumber: 'TESTE-DEV',
      locale,
      source: 'manual_test',
      deepLinkPath: quoteDeepLinkPath(entityId),
      environmentBanner: environmentBanner(locale),
    },
    source: 'manual_test',
  })
  await processNotificationQueue({ companyId: company.companyId, limit: 5, reason: 'manual_test' })
  return Response.json({ data: { ...result, test: true, replay: false } })
}
