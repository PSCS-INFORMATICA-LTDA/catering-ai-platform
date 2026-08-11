import InventoryDashboard from '@/components/inventory/InventoryDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EstoquePage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/estoque')

  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'inventory.view')
  if (!canView) {
    redirect('/orders')
  }

  return (
    <InventoryDashboard
      canManage={
        session.isPlatformAdmin ||
        hasPermission(session.permissions, 'inventory.manage')
      }
      canAdjust={
        session.isPlatformAdmin ||
        hasPermission(session.permissions, 'inventory.adjust')
      }
    />
  )
}
