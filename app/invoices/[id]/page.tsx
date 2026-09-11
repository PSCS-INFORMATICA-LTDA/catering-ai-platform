import InvoiceDetailView from '@/components/payments/InvoiceDetailView'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { fetchInvoiceBackofficeDetail } from '@/Lib/payments/fetchInvoiceBackoffice'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getAuthSession()
  if (!session) redirect(`/login?next=/invoices/${id}`)

  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.invoices.view') ||
    hasPermission(session.permissions, 'orders.financial.view')
  if (!canView) redirect('/quotes')

  const companyId = resolveAuthorizedCompanyId(session)
  const { data, error } = await fetchInvoiceBackofficeDetail(companyId, id)

  if (error?.status === 404 || !data) notFound()
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

  return <InvoiceDetailView invoice={data} />
}
