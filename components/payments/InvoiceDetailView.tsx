'use client'

import Link from 'next/link'
import {
  invoiceStatusLabel,
  paymentProviderLabel,
  paymentPurposeLabel,
  paymentStatusLabel,
  tPayments,
} from '@/Lib/i18n/payments'
import { formatUiDate, toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { InvoiceBackofficeDetail } from '@/Lib/payments/fetchInvoiceBackoffice'

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'border-cdl-border bg-cdl-inset text-cdl-text-secondary',
  ready: 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand',
  awaiting_deposit: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  partially_paid: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  paid: 'border-cdl-success-border bg-cdl-success-soft text-cdl-success',
  canceled: 'border-red-300/40 bg-red-500/10 text-red-500',
}

function formatMoney(
  value: number,
  currency: string,
  locale: string | null | undefined,
) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

function formatDateTime(
  value: string | null | undefined,
  locale: string | null | undefined,
) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(toBcp47Locale(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function paymentLinkState(
  link: InvoiceBackofficeDetail['payment_links'][number],
  locale: string | null | undefined,
) {
  if (link.revoked_at) return tPayments(locale, 'linkRevoked')
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return tPayments(locale, 'linkExpired')
  }
  return tPayments(locale, 'linkActive')
}

export default function InvoiceDetailView({
  invoice,
}: {
  invoice: InvoiceBackofficeDetail
}) {
  const locale = useAuthLocaleFromMe()
  const snapshot = invoice.snapshot
  const eventAddress = snapshot
    ? [
        snapshot.event.address,
        snapshot.event.city,
        snapshot.event.region,
        snapshot.event.postalCode,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/invoices"
            className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary-2)] hover:underline"
          >
            ← {tPayments(locale, 'backToInvoices')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
              {invoice.invoice_number}
            </h1>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                STATUS_BADGE_CLASS[invoice.status] ??
                'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
              }`}
            >
              {invoiceStatusLabel(invoice.status, locale)}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {tPayments(locale, 'sourceQuote')} {invoice.quote_number || '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/quotes/${invoice.quote_id}`}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-800 shadow-sm"
          >
            {tPayments(locale, 'sourceQuote')}
          </Link>
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[var(--brand-primary-2,#1e3a5f)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
          >
            {tPayments(locale, 'downloadPdf')}
          </a>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
          {tPayments(locale, 'financialSummary')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FinancialValue
            label={tPayments(locale, 'total')}
            value={formatMoney(invoice.total, invoice.currency_code, locale)}
          />
          <FinancialValue
            label={tPayments(locale, 'deposit')}
            value={formatMoney(invoice.deposit_amount, invoice.currency_code, locale)}
          />
          <FinancialValue
            label={tPayments(locale, 'originalBalance')}
            value={formatMoney(invoice.balance_amount, invoice.currency_code, locale)}
          />
          <FinancialValue
            label={tPayments(locale, 'paid')}
            value={formatMoney(invoice.paid_total, invoice.currency_code, locale)}
          />
          <FinancialValue
            label={tPayments(locale, 'invoiceOutstanding')}
            value={formatMoney(invoice.outstanding_amount, invoice.currency_code, locale)}
            strong
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
            {tPayments(locale, 'sourceAndEvent')}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow
              label={tPayments(locale, 'sourceQuote')}
              value={
                <Link
                  href={`/quotes/${invoice.quote_id}`}
                  className="font-bold text-[var(--brand-primary-2)] hover:underline"
                >
                  {invoice.quote_number || invoice.quote_id}
                </Link>
              }
            />
            <DetailRow label={tPayments(locale, 'event')} value={invoice.event_name || '—'} />
            <DetailRow
              label={tPayments(locale, 'eventDate')}
              value={formatUiDate(invoice.event_date, locale)}
            />
            <DetailRow
              label={tPayments(locale, 'eventAddress')}
              value={eventAddress || '—'}
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
            {tPayments(locale, 'customer')}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow
              label={tPayments(locale, 'customer')}
              value={snapshot?.customer.name || invoice.customer_name || '—'}
            />
            <DetailRow label={tPayments(locale, 'email')} value={snapshot?.customer.email || '—'} />
            <DetailRow label={tPayments(locale, 'phone')} value={snapshot?.customer.phone || '—'} />
          </dl>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
            {tPayments(locale, 'paymentsHistory')}
          </h2>
        </div>
        {invoice.payments.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tPayments(locale, 'noPayments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">{tPayments(locale, 'provider')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'purpose')}</th>
                  <th className="px-4 py-3 text-right">{tPayments(locale, 'total')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'filterStatus')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'reference')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'capturedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => {
                  const reference = payment.provider_capture_id || payment.provider_order_id || '—'
                  return (
                    <tr key={payment.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-bold text-neutral-900">
                        {paymentProviderLabel(payment.provider, locale)}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {paymentPurposeLabel(payment.purpose, locale)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-neutral-900">
                        {formatMoney(payment.amount, payment.currency_code, locale)}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {paymentStatusLabel(payment.status, locale)}
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-neutral-600" title={reference}>
                        {reference}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDateTime(payment.captured_at || payment.created_at, locale)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
            {tPayments(locale, 'paymentLinks')}
          </h2>
        </div>
        {invoice.payment_links.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tPayments(locale, 'noPaymentLinks')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">{tPayments(locale, 'purpose')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'filterStatus')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'createdAt')}</th>
                  <th className="px-4 py-3">{tPayments(locale, 'expiresAt')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payment_links.map((link) => (
                  <tr key={link.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-bold text-neutral-900">
                      {paymentPurposeLabel(link.purpose, locale)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{paymentLinkState(link, locale)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(link.created_at, locale)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(link.expires_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
          {tPayments(locale, 'traceability')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {tPayments(locale, 'traceabilityCopy')}
        </p>
      </section>
    </div>
  )
}

function FinancialValue({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg ${strong ? 'font-black' : 'font-bold'} text-neutral-900`}>{value}</p>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="font-semibold text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-neutral-900">{value}</dd>
    </div>
  )
}
