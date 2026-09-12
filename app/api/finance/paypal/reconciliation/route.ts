import { authorizedFinanceCompanyId, requirePaypalControlApi } from '@/Lib/payments/financeObservabilityAuth'
import { fetchPaypalMonitors } from '@/Lib/payments/fetchPaypalControl'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requirePaypalControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const result = await fetchPaypalMonitors({ companyId: company.companyId })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  return Response.json(
    {
      data: {
        failClosed: result.failClosed,
        environment: result.environment,
        idempotency: result.idempotency,
        reconciliation: result.reconciliation,
        holds: result.holds,
      },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
