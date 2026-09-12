import { authorizedFinanceCompanyId, requirePaypalControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchPaypalTransactions } from '@/Lib/payments/fetchPaypalControl'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requirePaypalControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const result = await fetchPaypalTransactions({
    companyId: company.companyId,
    searchParams: url.searchParams,
  })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    {
      data: result.rows,
      failClosed: result.failClosed,
      environment: result.environment,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
