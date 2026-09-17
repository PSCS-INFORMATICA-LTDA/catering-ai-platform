import NotificationCenterView from '@/components/notifications/NotificationCenterView'
import { hasPermission } from '@/Lib/auth/permissions'
import { requireSessionCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { tNotifications } from '@/Lib/i18n/notifications'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
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
  const [recipients, deliveries] = await Promise.all([
    db
      .from('notification_recipients')
      .select(
        'id, event_key, channel, display_name, phone_e164, locale, enabled, created_at',
      )
      .eq('company_id', companyContext.companyId)
      .order('created_at', { ascending: false }),
    db
      .from('notification_deliveries')
      .select(
        'id, channel, provider, template_key, status, provider_message_id, attempt_count, last_error, created_at, sent_at, failed_at',
      )
      .eq('company_id', companyContext.companyId)
      .order('created_at', { ascending: false })
      .limit(80),
  ])
  const canManage =
    session.isPlatformAdmin || hasPermission(session.permissions, 'notifications.manage')
  return (
    <NotificationCenterView
      title={tNotifications(locale, 'title')}
      locale={locale}
      canManage={canManage}
      recipients={recipients.data ?? []}
      deliveries={deliveries.data ?? []}
    />
  )
}
