import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { listInventoryLots } from '@/Lib/inventory/listInventoryLots'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/lots — foundation read-only. */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)

  const { data, error } = await listInventoryLots(companyId, {
    branchId: url.searchParams.get('branch_id'),
    catalogItemId: url.searchParams.get('catalog_item_id'),
    query: url.searchParams.get('q'),
    limit: Number(url.searchParams.get('limit') || 200),
  })

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ data })
}
