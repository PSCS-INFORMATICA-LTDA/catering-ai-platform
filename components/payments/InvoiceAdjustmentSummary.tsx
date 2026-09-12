'use client'

import Link from 'next/link'
import { tEventFinancialCloseout } from '@/Lib/i18n/eventFinancialCloseout'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { InvoiceBackofficeDetail } from '@/Lib/payments/fetchInvoiceBackoffice'

function money(value: number, currency: string, locale: string | null | undefined) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

export default function InvoiceAdjustmentSummary({ invoice }: { invoice: InvoiceBackofficeDetail }) {
  const locale = useAuthLocaleFromMe()
  const adjustment = invoice.snapshot?.adjustment

  if (!adjustment && invoice.supplemental_invoices.length === 0) return null

  if (!adjustment) {
    const supplementalTotal = invoice.supplemental_invoices.reduce((sum, item) => sum + item.total, 0)
    return (
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
          {tEventFinancialCloseout(locale, 'supplementalInvoice')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Value label={tEventFinancialCloseout(locale, 'originalTotal')} value={money(invoice.total, invoice.currency_code, locale)} />
          <Value label={tEventFinancialCloseout(locale, 'adjustmentTotal')} value={money(supplementalTotal, invoice.currency_code, locale)} />
          <Value label={tEventFinancialCloseout(locale, 'finalEventTotal')} value={money(invoice.total + supplementalTotal, invoice.currency_code, locale)} strong />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {invoice.supplemental_invoices.map((item) => (
            <Link key={item.id} href={`/invoices/${item.id}`} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
              {item.invoice_number} · {money(item.total, invoice.currency_code, locale)}
            </Link>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-amber-900">
            {tEventFinancialCloseout(locale, 'supplementalInvoice')}
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            {tEventFinancialCloseout(locale, 'originalInvoice')}:{' '}
            <Link href={`/invoices/${adjustment.originalInvoiceId}`} className="font-black hover:underline">
              {adjustment.originalInvoiceNumber}
            </Link>
            {' · '}OS {adjustment.serviceOrderNumber}
          </p>
        </div>
        {invoice.service_order_id ? (
          <Link href={`/orders/${invoice.service_order_id}`} className="text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
            {adjustment.serviceOrderNumber}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-white">
        <div className="divide-y divide-neutral-100">
          {(invoice.snapshot?.additionals ?? []).map((line) => (
            <div key={line.itemId} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <strong className="text-neutral-900">{line.label}</strong>
                <p className="text-xs text-neutral-500">
                  {line.quantity} × {money(line.unitPrice, invoice.currency_code, locale)}
                </p>
              </div>
              <strong className="text-neutral-900">{money(line.total, invoice.currency_code, locale)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Value label={tEventFinancialCloseout(locale, 'originalTotal')} value={money(adjustment.originalInvoiceTotal, invoice.currency_code, locale)} />
        <Value label={tEventFinancialCloseout(locale, 'adjustmentTotal')} value={money(invoice.total, invoice.currency_code, locale)} />
        <Value label={tEventFinancialCloseout(locale, 'finalEventTotal')} value={money(adjustment.finalEventTotal, invoice.currency_code, locale)} strong />
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        {tEventFinancialCloseout(locale, 'billableGuests')}: {adjustment.contractedBillableGuests} → {adjustment.finalBillableGuests}
        {adjustment.notes ? ` · ${adjustment.notes}` : ''}
      </p>
    </section>
  )
}

function Value({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg ${strong ? 'font-black' : 'font-bold'} text-neutral-900`}>{value}</p>
    </div>
  )
}
