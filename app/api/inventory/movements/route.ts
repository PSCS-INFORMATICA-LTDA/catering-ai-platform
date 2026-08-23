import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { listInventoryMovements } from '@/Lib/inventory/listInventoryMovements'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/movements — Kardex (sem custo/valuation). */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)

  const { data, error } = await listInventoryMovements(companyId, {
    branchId: url.searchParams.get('branch_id'),
    locationId: url.searchParams.get('location_id'),
    catalogItemId: url.searchParams.get('catalog_item_id'),
    lotId: url.searchParams.get('lot_id'),
    movementType: url.searchParams.get('movement_type'),
    movementCode: url.searchParams.get('movement_code'),
    documentId: url.searchParams.get('document_id'),
    serviceOrderId: url.searchParams.get('service_order_id'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    limit: Number(url.searchParams.get('limit') || 100),
  })

  if (error) {
    return Response.json({ error }, { status: 500 })
  }

  return Response.json({ data })
}
