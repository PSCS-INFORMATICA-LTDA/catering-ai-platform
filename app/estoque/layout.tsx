import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'
import InventorySubnav from '@/components/inventory/InventorySubnav'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EstoqueLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/estoque')

  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'inventory.view')
  if (!canView) redirect('/orders')

  return (
    <div className="min-h-screen bg-cdl-bg">
      <InventorySubnav />
      {children}
    </div>
  )
}
