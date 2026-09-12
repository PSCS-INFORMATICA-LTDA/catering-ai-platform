import { authorizedFinanceCompanyId, requireInvoiceControlApi } from '@/Lib/payments/financeObservabilityAuth'
import {
  fetchFinanceDashboard,
  parseInvoiceControlFilters,
} from '@/Lib/payments/fetchFinanceDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireInvoiceControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const filters = parseInvoiceControlFilters(url.searchParams)
  const result = await fetchFinanceDashboard({ companyId: company.companyId, filters })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    {
      data: result.invoices,
      kpis: result.kpis,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
