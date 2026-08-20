import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { listInventoryBranches } from '@/Lib/inventory/listInventoryBranches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/branches — filiais para filtros UI. */
export async function GET() {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await listInventoryBranches(companyId)
  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ data })
}
