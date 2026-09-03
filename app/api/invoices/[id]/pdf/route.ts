import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { loadCompanyInvoice } from '@/Lib/payments/createInvoiceFromQuote'
import {
  generateInvoicePdfBuffer,
  getInvoicePdfResponseHeaders,
} from '@/Lib/generateInvoicePdf'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response
  const { id } = await params
  const invoice = await loadCompanyInvoice(
    resolveAuthorizedCompanyId(auth.session),
    id,
  )
  if (!invoice) return Response.json({ error: 'not_found' }, { status: 404 })

  try {
    const buffer = await generateInvoicePdfBuffer(invoice)
    return new Response(new Uint8Array(buffer), {
      headers: getInvoicePdfResponseHeaders(invoice),
    })
  } catch (error) {
    console.error('invoice pdf failed', error)
    return Response.json({ error: 'pdf_generation_failed' }, { status: 500 })
  }
}
