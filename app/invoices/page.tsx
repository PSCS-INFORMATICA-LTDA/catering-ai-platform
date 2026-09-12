import InvoicesDashboard from '@/components/payments/InvoicesDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { fetchInvoiceBackofficeList } from '@/Lib/payments/fetchInvoiceBackoffice'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InvoicesPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/invoices')

  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.invoices.view') ||
    hasPermission(session.permissions, 'orders.financial.view')
  if (!canView) redirect('/quotes')

  const companyId = resolveAuthorizedCompanyId(session)
  const { data, error } = await fetchInvoiceBackofficeList(companyId)

  if (error) {
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  return <InvoicesDashboard initialInvoices={data ?? []} />
}
