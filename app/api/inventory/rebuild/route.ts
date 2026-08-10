import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { rebuildInventoryBalances } from '@/Lib/inventory/postInventory'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** POST /api/inventory/rebuild — recalcula saldos a partir do ledger (admin). */
export async function POST() {
  const auth = await requireApiPermission('inventory.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)

  const result = await rebuildInventoryBalances(companyId)
  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'inventory_balance',
    entityId: companyId,
    action: 'inventory_reconciliation_checked',
    newData: { rebuild: true, result },
  })

  if (result.ok === false) {
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ data: result })
}
