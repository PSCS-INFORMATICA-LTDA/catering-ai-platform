import { authorizedFinanceCompanyId, requireInvoiceControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchFinancePscsOne } from '@/Lib/payments/fetchFinanceControlCenter'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireInvoiceControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const result = await fetchFinancePscsOne({
    companyId: company.companyId,
    searchParams: url.searchParams,
  })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    {
      data: result.data,
      counts: result.counts,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
