import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getInventoryAvailability } from '@/Lib/inventory/getInventoryAvailability'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/availability — P41202-like (sem custo). */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)

  const { data, error } = await getInventoryAvailability(companyId, {
    branchId: url.searchParams.get('branch_id'),
    locationId: url.searchParams.get('location_id'),
    catalogItemId: url.searchParams.get('catalog_item_id'),
    lotId: url.searchParams.get('lot_id'),
    query: url.searchParams.get('q'),
    onlyWithStock: url.searchParams.get('only_with_stock') === '1',
    onlyCommitted: url.searchParams.get('only_committed') === '1',
    limit: Number(url.searchParams.get('limit') || 500),
  })

  if (error) {
    return Response.json({ error }, { status: 500 })
  }

  return Response.json({ data })
}
