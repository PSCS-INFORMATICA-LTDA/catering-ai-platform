import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { loadCompanyInvoice } from '@/Lib/payments/createInvoiceFromQuote'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response
  const { id } = await params
  const invoice = await loadCompanyInvoice(
    resolveAuthorizedCompanyId(auth.session),
    id,
  )
  if (!invoice) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  return Response.json({ data: invoice })
}
