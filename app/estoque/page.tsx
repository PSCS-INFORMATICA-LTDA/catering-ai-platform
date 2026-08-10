import InventoryDashboard from '@/components/inventory/InventoryDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EstoquePage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/estoque')

  if (!hasPermission(session.permissions, 'inventory.view')) {
    redirect('/orders')
  }

  return (
    <InventoryDashboard
      canManage={hasPermission(session.permissions, 'inventory.manage')}
      canAdjust={hasPermission(session.permissions, 'inventory.adjust')}
    />
  )
}
