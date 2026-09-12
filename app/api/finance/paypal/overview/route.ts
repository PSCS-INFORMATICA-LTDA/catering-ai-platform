import { authorizedFinanceCompanyId, requirePaypalControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchPaypalOverview } from '@/Lib/payments/fetchPaypalControl'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requirePaypalControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const result = await fetchPaypalOverview({
    companyId: company.companyId,
    period: url.searchParams.get('period'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    {
      data: {
        failClosed: result.failClosed,
        environment: result.environment,
        health: result.health,
        kpis: result.kpis,
      },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
