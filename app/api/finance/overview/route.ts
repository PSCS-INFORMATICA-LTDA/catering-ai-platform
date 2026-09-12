import { authorizedFinanceCompanyId, requireInvoiceControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchFinanceOverview } from '@/Lib/payments/fetchFinanceControlCenter'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireInvoiceControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const result = await fetchFinanceOverview({
    companyId: company.companyId,
    period: url.searchParams.get('period'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  })
  if (result.error && !result.data) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    { data: result.data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
