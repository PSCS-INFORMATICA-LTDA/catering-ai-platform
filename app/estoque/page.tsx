import InventoryDashboard from '@/components/inventory/InventoryDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EstoquePage() {
  const session = await getAuthSession()

  return (
    <InventoryDashboard
      canManage={
        session?.isPlatformAdmin ||
        hasPermission(session?.permissions ?? [], 'inventory.manage')
      }
      canAdjust={
        session?.isPlatformAdmin ||
        hasPermission(session?.permissions ?? [], 'inventory.adjust')
      }
    />
  )
}
