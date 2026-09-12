import FinanceControls from '@/components/payments/FinanceControls'
import InvoiceAdjustmentSummary from '@/components/payments/InvoiceAdjustmentSummary'
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

  if (error) {
    if (error.status === 404) notFound()
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }
  if (!data) notFound()

  const canReconcile =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.payments.reconcile')
  const canRefund =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.refunds.manage')
  const canCancel =
    data.invoice_kind !== 'post_event_adjustment' &&
    (session.isPlatformAdmin ||
      hasPermission(session.permissions, 'finance.invoices.cancel'))

  return (
    <div className="space-y-5">
      <InvoiceDetailView invoice={data} />
      <InvoiceAdjustmentSummary invoice={data} />
      <div className="mx-auto w-full max-w-6xl">
        <FinanceControls
          invoice={data}
          canReconcile={canReconcile}
          canRefund={canRefund}
          canCancel={canCancel}
        />
      </div>
    </div>
  )
}
