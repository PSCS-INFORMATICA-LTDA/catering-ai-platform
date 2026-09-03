import { tPayments } from '@/Lib/i18n/payments'
import { resolveAmountDue } from '@/Lib/payments/amountDue'
import type { InvoiceRecord, PaymentPurpose } from '@/Lib/payments/types'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function money(value: number, currency = 'USD') {
  return `${currency} ${Number(value || 0).toFixed(2)}`
}

export default function PublicPaymentPage({
  invoice,
  purpose,
  publicCheckout,
  paypalReady,
  locale,
}: {
  invoice: InvoiceRecord
  purpose: PaymentPurpose
  publicCheckout: boolean
  paypalReady: boolean
  locale?: string | null
}) {
  const lang: QuoteLanguage = locale === 'en' || locale === 'es' ? locale : invoice.locale
  const snap = invoice.snapshot
  const due = resolveAmountDue({
    total: invoice.total,
    depositAmount: invoice.deposit_amount,
    paidTotal: invoice.paid_total,
    purpose,
  })

  return (
    <main
      data-public-payment
      data-paypal-public-checkout={publicCheckout ? 'on' : 'off'}
      data-invoice-number={invoice.invoice_number}
      className="min-h-screen bg-[#f6f1ea] px-4 py-8 text-[#1b1b1b]"
    >
      <div className="mx-auto w-full max-w-lg space-y-5">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c1121f]">
            CDL BBQ AT HOME
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {tPayments(lang, 'publicPayTitle')}
          </h1>
          <p className="mt-1 text-sm text-[#6b6560]">
            {tPayments(lang, 'invoiceNumber', { number: invoice.invoice_number })}
          </p>
        </header>

        <section
          data-invoice-summary
          className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {tPayments(lang, 'invoiceSummary')}
          </h2>
          <p className="mt-3 font-semibold">{snap.customer.name}</p>
          <p className="text-sm text-[#6b6560]">
            {tPayments(lang, 'eventDate')}: {snap.event.date || '—'}
          </p>
          <p className="text-sm text-[#6b6560]">
            {tPayments(lang, 'eventAddress')}: {snap.event.address || '—'}
          </p>
          <p className="mt-2 text-sm font-medium">
            {tPayments(lang, 'packageLine')}: {snap.package.name || snap.package.key}
          </p>
          <p className="text-sm text-[#6b6560]">
            {tPayments(lang, 'guests')}: {snap.guests.adults} {tPayments(lang, 'adults')} ·{' '}
            {snap.guests.childrenUnder3 + snap.guests.children4To12}{' '}
            {tPayments(lang, 'children')}
          </p>
          {snap.garnishes?.included ? (
            <p className="text-sm text-[#6b6560]">
              {tPayments(lang, 'garnishes')}: {money(snap.garnishes.total, invoice.currency_code)}
            </p>
          ) : null}
          {snap.additionals.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-[#6b6560]">
              {snap.additionals.map((line) => (
                <li key={line.itemId}>
                  {tPayments(lang, 'additionals')}: {line.label} × {line.quantity} —{' '}
                  {money(line.total, invoice.currency_code)}
                </li>
              ))}
            </ul>
          ) : null}
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'mileage')}</dt>
              <dd>{money(snap.mileage.fee || 0, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'grill')}</dt>
              <dd>{money(snap.grill.total, invoice.currency_code)}</dd>
            </div>
            {snap.commercial.discount > 0 ? (
              <div className="flex justify-between">
                <dt>{tPayments(lang, 'discount')}</dt>
                <dd>-{money(snap.commercial.discount, invoice.currency_code)}</dd>
              </div>
            ) : null}
            {snap.commercial.holidaySurcharge > 0 ? (
              <div className="flex justify-between">
                <dt>{tPayments(lang, 'seasonalSurcharge')}</dt>
                <dd>{money(snap.commercial.holidaySurcharge, invoice.currency_code)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'subtotal')}</dt>
              <dd>{money(invoice.subtotal, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'total')}</dt>
              <dd>{money(invoice.total, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'deposit')}</dt>
              <dd>{money(invoice.deposit_amount, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'balance')}</dt>
              <dd>{money(invoice.balance_amount, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{tPayments(lang, 'paid')}</dt>
              <dd>{money(invoice.paid_total, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>{tPayments(lang, 'amountDue')}</dt>
              <dd data-amount-due>{money(due.amount, invoice.currency_code)}</dd>
            </div>
            <div className="flex justify-between text-[#6b6560]">
              <dt>{tPayments(lang, 'paymentStatus')}</dt>
              <dd data-invoice-status>{invoice.status}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[#6b6560]">{tPayments(lang, 'noTax')}</p>
        </section>

        <section data-payment-methods className="space-y-3 rounded-2xl border border-[#e8e2d9] bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {tPayments(lang, 'methods')}
          </h2>
          <p data-method-zelle className="text-sm">
            {tPayments(lang, 'zelle')}
          </p>
          <p data-method-bank-transfer className="text-sm">
            {tPayments(lang, 'bankTransfer')}
          </p>
          {publicCheckout && paypalReady ? (
            <p data-method-paypal className="text-sm font-semibold">
              {tPayments(lang, 'paypalSandboxReady')}
            </p>
          ) : (
            <p data-method-paypal-off className="text-sm text-[#6b6560]">
              {tPayments(lang, 'paypalUnavailable')}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
