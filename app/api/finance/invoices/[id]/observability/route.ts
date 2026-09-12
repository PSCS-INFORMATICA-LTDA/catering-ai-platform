import { authorizedFinanceCompanyId, requireInvoiceControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchInvoiceObservability } from '@/Lib/payments/fetchInvoiceObservability'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const auth = await requireInvoiceControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const { id } = await params
  const result = await fetchInvoiceObservability({
    companyId: company.companyId,
    invoiceId: id,
  })
  if (result.error) {
    return Response.json(
      { error: result.error.message },
      { status: result.error.status ?? 500 },
    )
  }

  return Response.json(
    { data: result.data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
