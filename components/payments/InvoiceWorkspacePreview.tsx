'use client'

import Link from 'next/link'
import {
  invoiceStatusLabel,
  paymentProviderLabel,
  paymentStatusLabel,
} from '@/Lib/i18n/payments'
import { tInvoiceWorkspace } from '@/Lib/i18n/invoiceWorkspace'
import type { InvoiceControlListItem } from '@/Lib/payments/financeObservabilityTypes'
import { formatFinanceDateTime, formatFinanceMoney, INVOICE_STATUS_BADGE, kindBadgeClass } from './financeUi'

export function InvoiceWorkspacePreview({
  invoice,
  locale,
  onClose,
}: {
  invoice: InvoiceControlListItem
  locale: string
  onClose: () => void
}) {
  return (
    <aside className="flex h-full w-full max-w-[420px] flex-col border-l border-neutral-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            {tInvoiceWorkspace(locale, 'previewTitle')}
          </p>
          <h2 className="mt-1 text-lg font-black text-neutral-900">{invoice.invoice_number}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${kindBadgeClass(invoice.invoice_kind)}`}>
              {invoice.invoice_kind === 'post_event_adjustment'
                ? tInvoiceWorkspace(locale, 'kindAdjustment')
                : tInvoiceWorkspace(locale, 'kindOriginal')}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${INVOICE_STATUS_BADGE[invoice.status] ?? ''}`}>
              {invoiceStatusLabel(invoice.status, locale)}
            </span>
            {invoice.divergence ? (
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
                {tInvoiceWorkspace(locale, 'divergence')}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[36px] items-center rounded-lg border border-neutral-200 px-3 text-xs font-bold uppercase"
        >
          {tInvoiceWorkspace(locale, 'closePreview')}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section className="space-y-1 text-sm">
          <p className="font-bold text-neutral-900">{invoice.customer_name}</p>
          <p className="text-neutral-500">{invoice.event_name || '—'}</p>
          <p className="text-neutral-500">{invoice.event_date || '—'}</p>
          <p>
            <span className="text-neutral-500">{tInvoiceWorkspace(locale, 'colQuote')}: </span>
            {invoice.quote_number || '—'}
          </p>
          <p>
            <span className="text-neutral-500">{tInvoiceWorkspace(locale, 'colOs')}: </span>
            {invoice.service_order_number || '—'}
          </p>
        </section>

        <dl className="grid grid-cols-2 gap-3">
          {[
            ['colTotal', invoice.total],
            ['colGross', invoice.gross_received],
            ['colRefunds', invoice.refunded_total],
            ['colNet', invoice.net_received],
            ['colOutstanding', invoice.outstanding_amount],
          ].map(([key, value]) => (
            <div key={key} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {tInvoiceWorkspace(locale, key as 'colTotal')}
              </dt>
              <dd className="mt-1 text-sm font-black">{formatFinanceMoney(Number(value), invoice.currency_code, locale)}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            {tInvoiceWorkspace(locale, 'previewPayments')}
          </h3>
          {invoice.recent_payments.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">{tInvoiceWorkspace(locale, 'previewEmptyPayments')}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {invoice.recent_payments.map((payment) => (
                <li key={payment.id} className="rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                  <p className="font-bold">
                    {formatFinanceMoney(payment.amount, payment.currency_code, locale)} · {paymentProviderLabel(payment.provider, locale)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {paymentStatusLabel(payment.status, locale)} · {formatFinanceDateTime(payment.captured_at || payment.created_at, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 p-4">
        <Link href={`/invoices/${invoice.id}`} className={previewLinkClass}>
          {tInvoiceWorkspace(locale, 'previewOpenInvoice')}
        </Link>
        <Link href={`/quotes/${invoice.quote_id}`} className={previewLinkClass}>
          {tInvoiceWorkspace(locale, 'actionOpenQuote')}
        </Link>
        {invoice.service_order_id ? (
          <Link href={`/orders/${invoice.service_order_id}`} className={previewLinkClass}>
            {tInvoiceWorkspace(locale, 'actionOpenOs')}
          </Link>
        ) : null}
        <a href={`/api/invoices/${invoice.id}/pdf`} className={previewLinkClass}>
          {tInvoiceWorkspace(locale, 'actionPdf')}
        </a>
      </div>
    </aside>
  )
}

const previewLinkClass =
  'inline-flex min-h-[40px] items-center justify-center rounded-xl border border-neutral-200 px-3 text-center text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50'
