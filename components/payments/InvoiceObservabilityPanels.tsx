'use client'

import Link from 'next/link'
import {
  invoiceStatusLabel,
  paymentProviderLabel,
  paymentPurposeLabel,
  paymentStatusLabel,
  tPayments,
} from '@/Lib/i18n/payments'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { tFinanceObservability } from '@/Lib/i18n/financeObservability'
import { buildDocumentaryLineage, computeInvoiceMoneyFlow } from '@/Lib/payments/financeControlCenter'
import { formatUiDate } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { InvoiceObservabilityPayload } from '@/Lib/payments/financeObservabilityTypes'
import FinanceCopyId from './FinanceCopyId'
import { formatFinanceDateTime, formatFinanceMoney, kindBadgeClass } from './financeUi'

export default function InvoiceObservabilityPanels({
  data,
}: {
  data: InvoiceObservabilityPayload
}) {
  const locale = useAuthLocaleFromMe()
  const invoice = data.invoice
  const check = data.financial_check
  const flow = computeInvoiceMoneyFlow({
    total: check.invoiceTotal,
    completedPaymentsTotal: check.completedPaymentsTotal,
    refundedTotal: check.refundedTotal,
    paidTotal: check.registeredPaidTotal,
    currency_code: invoice.currency_code,
  })
  const lineage = buildDocumentaryLineage({
    quote_id: invoice.quote_id,
    quote_number: invoice.quote_number,
    original_invoice_id:
      data.lineage.kind === 'post_event_adjustment' ? data.lineage.parent?.id ?? invoice.id : invoice.id,
    original_invoice_number:
      data.lineage.kind === 'post_event_adjustment'
        ? data.lineage.parent?.invoice_number ?? invoice.invoice_number
        : invoice.invoice_number,
    payment_id: data.payments.find((payment) => payment.status === 'completed')?.id ?? data.payments[0]?.id ?? null,
    service_order_id: invoice.service_order_id,
    service_order_number: invoice.service_order_number,
    event_name: invoice.event_name,
    closeout_id: invoice.closeout_id,
    supplemental_invoice_id:
      data.lineage.kind === 'post_event_adjustment'
        ? invoice.id
        : data.lineage.supplements[0]?.id ?? null,
    supplemental_invoice_number:
      data.lineage.kind === 'post_event_adjustment'
        ? invoice.invoice_number
        : data.lineage.supplements[0]?.invoice_number ?? null,
    final_payment_id:
      data.payments.filter((payment) => payment.status === 'completed').at(-1)?.id ?? null,
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
          {tFinanceObservability(locale, 'blockInvoice')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Value label={tPayments(locale, 'invoiceTitle')} value={invoice.invoice_number} />
          <Value
            label={tFinanceObservability(locale, 'invoiceKind')}
            value={
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${kindBadgeClass(invoice.invoice_kind)}`}>
                {invoice.invoice_kind === 'post_event_adjustment'
                  ? tFinanceObservability(locale, 'kindAdjustment')
                  : tFinanceObservability(locale, 'kindOriginal')}
              </span>
            }
          />
          <Value label={tPayments(locale, 'filterStatus')} value={invoiceStatusLabel(invoice.status, locale)} />
          <Value label={tFinanceObservability(locale, 'currency')} value={invoice.currency_code} />
          <Value label={tPayments(locale, 'subtotal')} value={formatFinanceMoney(invoice.subtotal, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'invoiceTotal')} value={formatFinanceMoney(invoice.total, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'registeredPaidTotal')} value={formatFinanceMoney(invoice.paid_total, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'outstanding')} value={formatFinanceMoney(invoice.outstanding_amount, invoice.currency_code, locale)} strong />
        </div>
      </section>

      <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'moneyFlowTitle')}>
        <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceControl(locale, 'moneyFlowTitle')}</h2>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {[
            [tFinanceControl(locale, 'moneyTotal'), flow.total],
            [tFinanceControl(locale, 'moneyPayments'), flow.payments],
            [tFinanceControl(locale, 'moneyRefunds'), flow.refunds],
            [tFinanceControl(locale, 'moneyNetPaid'), flow.net_paid],
            [tFinanceControl(locale, 'moneyOutstanding'), flow.outstanding],
          ].map(([label, value], index) => (
            <li key={String(label)} className="rounded-2xl bg-cdl-bg/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">{label}</p>
              <p className="mt-1 text-sm font-black">{formatFinanceMoney(Number(value), flow.currency_code, locale)}</p>
              {index < 4 ? <p className="mt-1 text-[10px] font-bold text-cdl-muted" aria-hidden>↓</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'lineageTitle')}>
        <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceControl(locale, 'lineageTitle')}</h2>
        <ol className="mt-4 space-y-2">
          {lineage.filter((node) => node.present).map((node) => (
            <li key={node.key} className="flex flex-col gap-1 rounded-xl bg-cdl-bg/70 px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">
                {tFinanceControl(
                  locale,
                  node.key === 'quote'
                    ? 'lineageQuote'
                    : node.key === 'original_invoice'
                      ? 'lineageOriginal'
                      : node.key === 'payment'
                        ? 'lineagePayment'
                        : node.key === 'service_order'
                          ? 'lineageOs'
                          : node.key === 'event'
                            ? 'lineageEvent'
                            : node.key === 'closeout'
                              ? 'lineageCloseout'
                              : node.key === 'supplemental_invoice'
                                ? 'lineageSupplemental'
                                : 'lineageFinalPayment',
                )}
              </span>
              {node.href ? (
                <Link href={node.href} className="text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
                  {node.label}
                </Link>
              ) : (
                <span className="text-sm font-bold">{node.label}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
          {tFinanceObservability(locale, 'blockOrigin')}
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail label={tPayments(locale, 'sourceQuote')} value={<Link href={`/quotes/${invoice.quote_id}`} className="font-bold text-[var(--brand-primary-2)] hover:underline">{invoice.quote_number || invoice.quote_id}</Link>} />
          <Detail
            label={tFinanceObservability(locale, 'serviceOrder')}
            value={
              invoice.service_order_id ? (
                <Link href={`/orders/${invoice.service_order_id}`} className="font-bold text-[var(--brand-primary-2)] hover:underline">
                  {invoice.service_order_number || invoice.service_order_id}
                </Link>
              ) : '—'
            }
          />
          <Detail label={tPayments(locale, 'event')} value={`${invoice.event_name || '—'} · ${formatUiDate(invoice.event_date, locale)}`} />
          <Detail label={tPayments(locale, 'customer')} value={invoice.customer_name} />
        </dl>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
          {tFinanceObservability(locale, 'blockLineage')}
        </h2>
        {data.lineage.kind === 'post_event_adjustment' ? (
          <div className="mt-4 space-y-3">
            <Detail
              label={tFinanceObservability(locale, 'parentOriginal')}
              value={
                data.lineage.parent ? (
                  <Link href={`/invoices/${data.lineage.parent.id}`} className="font-bold text-[var(--brand-primary-2)] hover:underline">
                    {data.lineage.parent.invoice_number}
                  </Link>
                ) : '—'
              }
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Value label={tFinanceObservability(locale, 'originalTotal')} value={formatFinanceMoney(data.lineage.original_total ?? 0, invoice.currency_code, locale)} />
              <Value label={tFinanceObservability(locale, 'adjustmentTotal')} value={formatFinanceMoney(data.lineage.adjustment_total ?? invoice.total, invoice.currency_code, locale)} />
              <Value label={tFinanceObservability(locale, 'finalEventTotal')} value={formatFinanceMoney(data.lineage.final_event_total ?? 0, invoice.currency_code, locale)} strong />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Value label={tFinanceObservability(locale, 'originalTotal')} value={formatFinanceMoney(invoice.total, invoice.currency_code, locale)} />
              <Value label={tFinanceObservability(locale, 'adjustmentTotal')} value={formatFinanceMoney(data.lineage.adjustment_total ?? 0, invoice.currency_code, locale)} />
              <Value label={tFinanceObservability(locale, 'finalEventTotal')} value={formatFinanceMoney(data.lineage.final_event_total ?? invoice.total, invoice.currency_code, locale)} strong />
            </div>
            {data.lineage.supplements.length === 0 ? (
              <p className="text-sm text-neutral-500">{tFinanceObservability(locale, 'noSupplements')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.lineage.supplements.map((child) => (
                  <Link key={child.id} href={`/invoices/${child.id}`} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
                    {child.invoice_number} · {formatFinanceMoney(child.total, invoice.currency_code, locale)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className={`rounded-2xl border p-5 shadow-sm ${check.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-300 bg-amber-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
            {tFinanceObservability(locale, 'blockFinancialCheck')}
          </h2>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${check.ok ? 'border-emerald-300 text-emerald-800' : 'border-amber-400 text-amber-900'}`}>
            {check.ok
              ? tFinanceObservability(locale, 'financialCheckOk')
              : tFinanceObservability(locale, 'financialCheckAttention')}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Value label={tFinanceObservability(locale, 'invoiceTotal')} value={formatFinanceMoney(check.invoiceTotal, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'completedPayments')} value={formatFinanceMoney(check.completedPaymentsTotal, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'refundedTotal')} value={formatFinanceMoney(check.refundedTotal, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'registeredPaidTotal')} value={formatFinanceMoney(check.registeredPaidTotal, invoice.currency_code, locale)} />
          <Value label={tFinanceObservability(locale, 'outstanding')} value={formatFinanceMoney(check.outstanding, invoice.currency_code, locale)} strong />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceObservability(locale, 'blockPayments')}</h2>
        </div>
        {data.payments.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tFinanceObservability(locale, 'noPayments')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.payments.map((payment) => (
              <li key={payment.id} className="grid gap-2 px-5 py-4 sm:grid-cols-2">
                <p className="text-sm font-bold">{paymentProviderLabel(payment.provider, locale)} · {paymentPurposeLabel(payment.purpose, locale)}</p>
                <p className="text-sm">{paymentStatusLabel(payment.status, locale)} · {formatFinanceMoney(payment.amount, payment.currency_code, locale)}</p>
                <p className="text-xs text-neutral-500">{formatFinanceDateTime(payment.created_at, locale)}</p>
                <p className="text-xs text-neutral-500">{tFinanceObservability(locale, 'approvedCaptured')}: {formatFinanceDateTime(payment.captured_at, locale)}</p>
                <FinanceCopyId value={payment.provider_order_id} label={tFinanceObservability(locale, 'providerOrderId')} />
                <FinanceCopyId value={payment.provider_capture_id} label={tFinanceObservability(locale, 'providerCaptureId')} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceObservability(locale, 'blockLinks')}</h2>
        </div>
        {data.payment_links.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tFinanceObservability(locale, 'noLinks')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.payment_links.map((link) => (
              <li key={link.id} className="grid gap-2 px-5 py-4 sm:grid-cols-4">
                <p className="font-bold">{paymentPurposeLabel(link.purpose, locale)}</p>
                <p>{tFinanceObservability(locale, link.state === 'revoked' ? 'linkRevoked' : link.state === 'expired' ? 'linkExpired' : 'linkActive')}</p>
                <p className="text-sm text-neutral-600">{formatFinanceDateTime(link.created_at, locale)}</p>
                <p className="text-sm text-neutral-600">{formatFinanceDateTime(link.expires_at, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceObservability(locale, 'blockRefunds')}</h2>
        </div>
        {data.refunds.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tFinanceObservability(locale, 'noRefunds')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.refunds.map((refund) => (
              <li key={refund.id} className="grid gap-2 px-5 py-4 sm:grid-cols-2">
                <p className="font-bold">{refund.status} · {formatFinanceMoney(refund.amount, invoice.currency_code, locale)}</p>
                <p className="text-sm">{refund.reason || '—'}</p>
                <FinanceCopyId value={refund.provider_refund_id} label={tFinanceObservability(locale, 'refundProviderId')} />
                <p className="text-xs text-neutral-500">{formatFinanceDateTime(refund.requested_at, locale)} → {formatFinanceDateTime(refund.completed_at, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceObservability(locale, 'blockCancellation')}</h2>
        </div>
        {data.cancellations.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tFinanceObservability(locale, 'noCancellations')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.cancellations.map((cancellation) => (
              <li key={cancellation.id} className="grid gap-2 px-5 py-4 sm:grid-cols-2">
                <p className="font-bold">{cancellation.status}</p>
                <p className="text-sm">{cancellation.reason || '—'}</p>
                <p className="text-xs text-neutral-500">{tFinanceObservability(locale, 'requestedAt')}: {formatFinanceDateTime(cancellation.requested_at, locale)}</p>
                <p className="text-xs text-neutral-500">{tFinanceObservability(locale, 'agendaReleased')}: {formatFinanceDateTime(cancellation.agenda_released_at, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceObservability(locale, 'blockIntegration')}</h2>
        </div>
        {data.outbox.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tFinanceObservability(locale, 'noOutbox')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.outbox.map((row) => (
              <li key={row.id} className="grid gap-1 px-5 py-4 text-sm">
                <p className="font-bold">{row.event_type} · {row.status}</p>
                <p className="text-xs text-neutral-500">{row.destination} · {formatFinanceDateTime(row.created_at, locale)}</p>
                {row.last_error ? <p className="text-xs text-red-600">{row.last_error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{tFinanceObservability(locale, 'blockAudit')}</h2>
        </div>
        {data.audit.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">{tFinanceObservability(locale, 'noAudit')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.audit.map((event) => (
              <li key={event.id} className="px-5 py-4 text-sm">
                <p className="font-bold">{event.action}</p>
                <p className="text-xs text-neutral-500">{event.entity_type} · {formatFinanceDateTime(event.created_at, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Value({
  label,
  value,
  strong = false,
}: {
  label: string
  value: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className="rounded-xl bg-white/80 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <div className={`mt-1 text-lg ${strong ? 'font-black' : 'font-bold'} text-neutral-900`}>{value}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm text-neutral-900">{value}</dd>
    </div>
  )
}
