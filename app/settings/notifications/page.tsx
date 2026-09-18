import NotificationCenterView from '@/components/notifications/NotificationCenterView'
import { hasPermission } from '@/Lib/auth/permissions'
import { requireSessionCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { tNotifications } from '@/Lib/i18n/notifications'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { buildMetaChecklist } from '@/Lib/notifications/metaChecklist'
import { loadPaymentNotificationSummary } from '@/Lib/notifications/loadPaymentNotificationSummary'
import { maskPhone } from '@/Lib/notifications/maskPhone'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NotificationSettingsPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/settings/notifications')
  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'notifications.view') ||
    hasPermission(session.permissions, 'notification_deliveries.view')
  if (!canView) redirect('/quotes')
  const locale = resolveAuthLocale(session.appUser?.preferred_language)
  const companyContext = requireSessionCompanyId(session)
  if (!companyContext.ok) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">{tNotifications(locale, 'title')}</h1>
        <p className="mt-3 text-sm text-neutral-600">
          {tNotifications(locale, 'companyContextRequired')}
        </p>
      </main>
    )
  }
  const db = getSupabaseServerClient()
  const [recipients, subscriptions, deliveries, summary] = await Promise.all([
    db
      .from('notification_recipients')
      .select('id, display_name, phone_e164, locale, enabled, channel, person_id, consent_status, created_at')
      .eq('company_id', companyContext.companyId)
      .order('created_at', { ascending: false }),
    db
      .from('notification_subscriptions')
      .select('recipient_id, event_key, enabled')
      .eq('company_id', companyContext.companyId),
    db
      .from('notification_deliveries')
      .select(
        'id, channel, provider, template_key, status, provider_message_id, attempt_count, last_error, created_at, sent_at, delivered_at, read_at, failed_at, notification_events!event_id(event_key, entity_type, entity_id, payload), notification_recipients!recipient_id(display_name, phone_e164)',
      )
      .eq('company_id', companyContext.companyId)
      .order('created_at', { ascending: false })
      .limit(120),
    loadPaymentNotificationSummary(companyContext.companyId),
  ])
  const canManage =
    session.isPlatformAdmin || hasPermission(session.permissions, 'notifications.manage')
  return (
    <NotificationCenterView
      title={tNotifications(locale, 'title')}
      locale={locale}
      canManage={canManage}
      recipients={(recipients.data ?? []).map((row) => ({
        ...row,
        consent_status: row.consent_status ?? 'unknown',
        subscriptions: (subscriptions.data ?? []).filter((item) => item.recipient_id === row.id),
      }))}
      deliveries={(deliveries.data ?? []).map((row) => {
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
          quote_number: (payload.quoteNumber as string | undefined) ?? null,
          invoice_number: (payload.invoiceNumber as string | undefined) ?? null,
          customer_name: (payload.customerName as string | undefined) ?? null,
          event_name: (payload.eventName as string | undefined) ?? null,
          amount: (payload.amount as number | undefined) ?? null,
          recipient_name: recipient?.display_name ?? null,
          phone_masked: maskPhone(recipient?.phone_e164),
          deep_link: (payload.deepLinkPath as string | undefined) ?? null,
        }
      })}
      provider={summary.provider}
      meta={buildMetaChecklist()}
    />
  )
}
