import { authorizedFinanceCompanyId, requireInvoiceControlApi } from '@/Lib/payments/financeObservabilityAuth'
import {
  fetchFinanceDashboard,
  parseInvoiceControlFilters,
} from '@/Lib/payments/fetchFinanceDashboard'
import {
  buildInvoiceWorkspaceCsv,
  invoiceWorkspaceCsvHasForbiddenContent,
} from '@/Lib/payments/invoiceWorkspace'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireInvoiceControlApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const company = authorizedFinanceCompanyId(auth.session, url.searchParams.get('company_id'))
  if (!company.ok) return company.response

  const filters = parseInvoiceControlFilters(url.searchParams)
  const result = await fetchFinanceDashboard({
    companyId: company.companyId,
    filters,
    mode: 'export',
  })
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  const csv = buildInvoiceWorkspaceCsv(result.invoices)
  if (invoiceWorkspaceCsvHasForbiddenContent(csv)) {
    return Response.json({ error: 'export_blocked' }, { status: 500 })
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="faturamento.csv"',
    },
  })
}
