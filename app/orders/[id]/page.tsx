import OrderDetailView from '@/components/orders/OrderDetailView'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { fetchServiceOrderDetail } from '@/Lib/orders/fetchServiceOrderDetail'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session) redirect(`/login?next=/orders/${id}`)

  const canView =
    session.isPlatformAdmin || hasPermission(session.permissions, 'orders.view')
  if (!canView) redirect('/quotes')

  const canManage =
    session.isPlatformAdmin || hasPermission(session.permissions, 'orders.manage')
  const canViewFinancial =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'orders.financial.view')
  const canMaterialsView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'orders.materials.view') ||
    canManage
  const canMaterialsPrepare =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'orders.materials.prepare')
  const canMaterialsCheck =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'orders.materials.check')

  const companyId = resolveAuthorizedCompanyId(session)
  const { data, error } = await fetchServiceOrderDetail(companyId, id, {
    includeFinancial: canViewFinancial,
  })

  if (error) {
    if (error.status === 404) notFound()
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  if (!data) notFound()

  return (
    <OrderDetailView
      initialOrder={data}
      canManage={canManage}
      canViewFinancial={canViewFinancial}
      canMaterialsView={canMaterialsView}
      canMaterialsPrepare={canMaterialsPrepare}
      canMaterialsCheck={canMaterialsCheck}
    />
  )
}
