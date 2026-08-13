import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { listInventoryDocuments } from '@/Lib/inventory/inventoryDocuments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/documents — cabeçalhos (sem custo). */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)

  const { data, error } = await listInventoryDocuments(companyId, {
    branchId: url.searchParams.get('branch_id'),
    documentType: url.searchParams.get('document_type'),
    movementCode: url.searchParams.get('movement_code'),
    serviceOrderId: url.searchParams.get('service_order_id'),
    status: url.searchParams.get('status'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    limit: Number(url.searchParams.get('limit') || 100),
  })

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ data })
}
