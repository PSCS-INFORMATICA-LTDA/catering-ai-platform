import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getInventoryDocumentDetail } from '@/Lib/inventory/inventoryDocuments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/documents/[id] — header + lines + movements. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  const { data, error } = await getInventoryDocumentDetail(companyId, id)
  if (error === 'document_not_found') {
    return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })
  }
  if (error) return Response.json({ error }, { status: 500 })

  return Response.json({ data })
}
