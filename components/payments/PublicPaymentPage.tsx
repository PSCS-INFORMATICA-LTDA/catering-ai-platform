import InvoiceFinancialBreakdown from '@/components/payments/InvoiceFinancialBreakdown'
import PaypalSandboxCheckout from '@/components/payments/PaypalSandboxCheckout'
import { tEventFinancialCloseout } from '@/Lib/i18n/eventFinancialCloseout'
import {
  invoiceStatusLabel,
  paymentPurposeLabel,
  paymentStatusLabel,
  tPayments,
} from '@/Lib/i18n/payments'
import { INVOICE_LOGO_WEB_CLASS } from '@/Lib/payments/invoiceBrand'
import { resolvePublicPaymentLocale } from '@/Lib/payments/invoiceDocumentLocale'
import { buildInvoiceFinancialPresentation } from '@/Lib/payments/invoiceFinancialPresentation'
import { isAppPublicLogoPath } from '@/Lib/payments/paymentOgCopy'
import type { InvoiceRecord, PaymentPurpose } from '@/Lib/payments/types'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function money(value: number, currency = 'USD') {
  return `${currency} ${Number(value || 0).toFixed(2)}`
}

const FALLBACK_COMPANY = 'Catering AI'

export default function PublicPaymentPage({
  invoice,
  purpose,
  amountDue,
  invoiceOutstanding,
  companyDisplayName,
  companyLogoSrc,
  publicCheckout,
  paypalClientId,
  paymentToken,
  locale,
  purposeAvailable = true,
  purposeAvailableAt = null,
}: {
  invoice: InvoiceRecord
  purpose: PaymentPurpose
  amountDue: number
  invoiceOutstanding: number
  companyDisplayName: string
  companyLogoSrc?: string | null
  publicCheckout: boolean
  paypalClientId: string | null
  paymentToken: string
  locale?: string | null
  purposeAvailable?: boolean
  purposeAvailableAt?: string | null
}) {
  const lang: QuoteLanguage = resolvePublicPaymentLocale({
    invoiceLocale: invoice.locale,
    previewLang: locale,
  })
  const snap = invoice.snapshot
  const adjustment = snap.adjustment
  const brandName = companyDisplayName.trim() || FALLBACK_COMPANY
  const logoSrc = isAppPublicLogoPath(companyLogoSrc) ? companyLogoSrc : null
  const paypalReady =
    publicCheckout && Boolean(paypalClientId) && amountDue > 0 && purposeAvailable
  const presentation = buildInvoiceFinancialPresentation({
    snapshot: snap,
    invoiceKind: invoice.invoice_kind,
    subtotal: invoice.subtotal,
    total: invoice.total,
    depositAmount: invoice.deposit_amount,
    balanceAmount: invoice.balance_amount,
    paidTotal: invoice.paid_total,
    currency: invoice.currency_code,
  })
  const lockedWhen = purposeAvailableAt
    ? new Date(purposeAvailableAt).toLocaleString(
        lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US',
        { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' },
      )
    : null

  return (
    <main
      data-public-payment
      data-paypal-public-checkout={publicCheckout ? 'on' : 'off'}
      data-invoice-number={invoice.invoice_number}
      data-invoice-kind={invoice.invoice_kind}
      data-company-brand={brandName}
      data-amount-due-value={amountDue.toFixed(2)}
      data-document-locale={lang}
      className="min-h-screen bg-[#f6f1ea] px-4 py-8 text-[#1b1b1b]"
    >
      <div className="mx-auto w-full max-w-lg space-y-5">
        <header>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" className={INVOICE_LOGO_WEB_CLASS} />
          ) : null}
          <p
            data-testid="payment-company-brand"
            className="text-xs font-black uppercase tracking-[0.2em] text-[#c1121f]"
          >
            {brandName}
          </p>
          <h1 className="mt-2 text-3xl font-black">{tPayments(lang, 'publicPayTitle')}</h1>
          <p className="mt-1 text-sm text-[#6b6560]">
            {tPayments(lang, 'invoiceNumber', { number: invoice.invoice_number })}
          </p>
          {adjustment ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
              {tEventFinancialCloseout(lang, 'supplementalInvoice')} · {tEventFinancialCloseout(lang, 'originalInvoice')} {adjustment.originalInvoiceNumber}
            </p>
          ) : null}
        </header>

        <section data-invoice-summary className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider">{tPayments(lang, 'invoiceSummary')}</h2>
          <p className="mt-3 font-semibold">{snap.customer.name}</p>
          <p className="text-sm text-[#6b6560]">{tPayments(lang, 'eventDate')}: {snap.event.date || '—'}</p>
          <p className="text-sm text-[#6b6560]">{tPayments(lang, 'eventAddress')}: {snap.event.address || '—'}</p>
          {adjustment ? (
            <p className="mt-2 text-sm font-medium">
              {tEventFinancialCloseout(lang, 'detailedAdjustment')} · OS {adjustment.serviceOrderNumber}
            </p>
          ) : null}
          <div className="mt-4">
            <InvoiceFinancialBreakdown presentation={presentation} locale={lang} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between font-bold"><dt>{tPayments(lang, 'invoiceOutstanding')}</dt><dd data-invoice-outstanding>{money(invoiceOutstanding, invoice.currency_code)}</dd></div>
            <div className="flex justify-between"><dt>{paymentPurposeLabel(purpose, lang)} — {tPayments(lang, 'amountDue')}</dt><dd data-amount-due>{money(amountDue, invoice.currency_code)}</dd></div>
            <div className="flex justify-between text-[#6b6560]"><dt>{tPayments(lang, 'paymentStatus')}</dt><dd data-invoice-status>{invoiceStatusLabel(invoice.status, lang)}</dd></div>
          </dl>
          {adjustment?.notes ? <p className="mt-3 text-xs text-[#6b6560]">{adjustment.notes}</p> : null}
          <p className="mt-3 text-xs text-[#6b6560]">{tPayments(lang, 'noTax')}</p>
        </section>

        {!purposeAvailable ? (
          <section
            data-testid="balance-locked"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <p className="font-bold">{tPayments(lang, 'balanceNotAvailableYet')}</p>
            {lockedWhen ? (
              <p className="mt-1">{tPayments(lang, 'balanceLockedUntil', { when: lockedWhen })}</p>
            ) : null}
          </section>
        ) : null}

        {paypalReady && paypalClientId ? (
          <PaypalSandboxCheckout
            token={paymentToken}
            clientId={paypalClientId}
            currency={invoice.currency_code}
            locale={lang}
          />
        ) : (
          <section data-payment-methods className="space-y-3 rounded-2xl border border-[#e8e2d9] bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider">{tPayments(lang, 'methods')}</h2>
            <p data-method-zelle className="text-sm">{tPayments(lang, 'zelle')}</p>
            <p data-method-bank-transfer className="text-sm">{tPayments(lang, 'bankTransfer')}</p>
            <p data-method-paypal-off className="text-sm text-[#6b6560]">
              {amountDue <= 0
                ? invoice.status === 'paid'
                  ? tPayments(lang, 'alreadyPaid')
                  : `${paymentPurposeLabel(purpose, lang)}: ${paymentStatusLabel('completed', lang)}`
                : tPayments(lang, 'paypalUnavailable')}
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
