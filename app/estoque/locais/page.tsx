import InventoryLocationsView from '@/components/inventory/InventoryLocationsView'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LocaisPage() {
  const session = await getAuthSession()
  const canManage =
    session?.isPlatformAdmin ||
    hasPermission(session?.permissions ?? [], 'inventory.manage')

  return <InventoryLocationsView canManage={canManage} />
}
