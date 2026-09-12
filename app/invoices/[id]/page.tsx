import { FinanceBackLink, FinanceBreadcrumb } from '@/components/finance/FinanceChrome'
import FinanceControls from '@/components/payments/FinanceControls'
import InvoiceAdjustmentSummary from '@/components/payments/InvoiceAdjustmentSummary'
import InvoiceObservabilityPanels from '@/components/payments/InvoiceObservabilityPanels'
import Link from 'next/link'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { tPayments } from '@/Lib/i18n/payments'
import { fetchInvoiceBackofficeDetail } from '@/Lib/payments/fetchInvoiceBackoffice'
import { fetchInvoiceObservability } from '@/Lib/payments/fetchInvoiceObservability'
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
  const [detail, observability] = await Promise.all([
    fetchInvoiceBackofficeDetail(companyId, id),
    fetchInvoiceObservability({ companyId, invoiceId: id }),
  ])

  if (detail.error) {
    if (detail.error.status === 404) notFound()
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {detail.error.message}
        </pre>
      </main>
    )
  }
  if (!detail.data) notFound()

  const canReconcile =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.payments.reconcile')
  const canRefund =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.refunds.manage')
  const canCancel =
    detail.data.invoice_kind !== 'post_event_adjustment' &&
    (session.isPlatformAdmin ||
      hasPermission(session.permissions, 'finance.invoices.cancel'))
  const locale = session.appUser?.preferred_language ?? 'pt'

  return (
    <div className="space-y-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <FinanceBreadcrumb locale={locale} current={detail.data.invoice_number} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <FinanceBackLink locale={locale} />
          <Link
            href="/invoices"
            className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary-2)] hover:underline"
          >
            ← {tPayments(locale, 'backToInvoices')}
          </Link>
        </div>
        <a
          href={`/api/invoices/${detail.data.id}/pdf`}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[var(--brand-primary-2,#1e3a5f)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
        >
          {tPayments(locale, 'downloadPdf')}
        </a>
        </div>
      </div>
      {observability.data ? (
        <InvoiceObservabilityPanels data={observability.data} />
      ) : (
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {observability.error?.message}
        </div>
      )}
      <InvoiceAdjustmentSummary invoice={detail.data} />
      <div className="mx-auto w-full max-w-6xl">
        <FinanceControls
          invoice={detail.data}
          canReconcile={canReconcile}
          canRefund={canRefund}
          canCancel={canCancel}
        />
      </div>
    </div>
  )
}
