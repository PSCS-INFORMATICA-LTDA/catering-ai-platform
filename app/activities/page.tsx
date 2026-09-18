import ActivityCenterView from '@/components/activities/ActivityCenterView'
import { hasPermission } from '@/Lib/auth/permissions'
import { requireSessionCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { tActivities } from '@/Lib/i18n/activities'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { loadActivityCenter, loadActivityTimeline } from '@/Lib/notifications/loadActivityCenter'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; focus?: string; from?: string; to?: string; q?: string }>
}) {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/activities')
  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'notifications.view') ||
    hasPermission(session.permissions, 'notification_deliveries.view') ||
    hasPermission(session.permissions, 'finance.invoices.view') ||
    hasPermission(session.permissions, 'orders.financial.view')
  if (!canView) redirect('/quotes')
  const locale = resolveAuthLocale(session.appUser?.preferred_language)
  const company = requireSessionCompanyId(session)
  if (!company.ok) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">{tActivities(locale, 'title')}</h1>
        <p className="mt-3 text-sm text-neutral-600">{tActivities(locale, 'companyContextRequired')}</p>
      </main>
    )
  }
  const params = await searchParams
  const canViewFinance =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.invoices.view') ||
    hasPermission(session.permissions, 'orders.financial.view')
  const [data, timeline] = await Promise.all([
    loadActivityCenter(company.companyId, {
      from: params.from,
      to: params.to,
      query: params.q,
    }),
    loadActivityTimeline({
      companyId: company.companyId,
      invoiceId: params.focus?.startsWith('invoice:') ? params.focus.slice(8) : null,
      quoteId: params.focus?.startsWith('quote:') ? params.focus.slice(6) : null,
    }),
  ])
  return (
    <ActivityCenterView
      locale={locale}
      canViewFinance={canViewFinance}
      data={data}
      timeline={timeline}
      initialTab={params.tab}
    />
  )
}
