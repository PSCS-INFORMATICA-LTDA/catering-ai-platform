import OrdersDashboard from '@/components/orders/OrdersDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { fetchServiceOrderList } from '@/Lib/orders/fetchServiceOrderList'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrdersPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/orders')

  const canView =
    session.isPlatformAdmin || hasPermission(session.permissions, 'orders.view')
  if (!canView) redirect('/quotes')

  const canViewFinancial =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'orders.financial.view')

  const companyId = resolveAuthorizedCompanyId(session)
  const { data, error } = await fetchServiceOrderList(companyId, {
    includeFinancial: canViewFinancial,
  })

  if (error) {
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  return (
    <OrdersDashboard
      initialOrders={data ?? []}
      canViewFinancial={canViewFinancial}
    />
  )
}
