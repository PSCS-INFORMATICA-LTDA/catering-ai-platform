import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { reconcileInventoryBalances } from '@/Lib/inventory/reconcileInventory'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/inventory/rebuild — rebuild + reconciliação (admin).
 * Query ?rebuild_only=1 — só rebuild, sem diff ledger.
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission('inventory.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const rebuildOnly = url.searchParams.get('rebuild_only') === '1'

  const report = await reconcileInventoryBalances({
    companyId,
    rebuildFirst: true,
  })

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'inventory_balance',
    entityId: companyId,
    action: 'inventory_reconciliation_checked',
    newData: {
      ok: report.ok,
      checked_rows: report.checked_rows,
      mismatch_count: report.mismatches.length,
      rebuild_only: rebuildOnly,
    },
  })

  if (report.rebuild?.ok === false) {
    return Response.json({ error: report.error || report.rebuild.error }, { status: 500 })
  }

  if (rebuildOnly) {
    return Response.json({ data: report.rebuild })
  }

  return Response.json({ data: report })
}
