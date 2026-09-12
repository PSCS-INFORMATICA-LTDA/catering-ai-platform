import { authorizedFinanceCompanyId, requireInvoiceControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchFinanceActivity } from '@/Lib/payments/fetchFinanceControlCenter'
import { parseFinancePage, parseFinancePageSize } from '@/Lib/payments/financeObservability'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireInvoiceControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const result = await fetchFinanceActivity({
    companyId: company.companyId,
    page: parseFinancePage(url.searchParams.get('page')),
    pageSize: parseFinancePageSize(url.searchParams.get('pageSize')),
  })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    { data: result.data, total: result.total, page: result.page, pageSize: result.pageSize },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
