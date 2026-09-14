'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { tPayments } from '@/Lib/i18n/payments'
import { tCommon } from '@/Lib/i18n/common'
import { CUSTOMER_DISPLAY_NAME_EMPTY } from '@/Lib/getCustomerDisplayName'
import {
  buildPaymentShareMessage,
  buildPaymentWhatsAppHref,
  customerFirstNameFromDisplayName,
  paymentSharePhoneDigits,
} from '@/Lib/payments/paymentShareMessage'
import { copyWhatsAppMessageSync, formatWhatsAppPhoneDisplay } from '@/Lib/whatsapp'
import { resolveTenantCompanyDisplayName } from '@/Lib/tenant/companyDisplayName'
import { useTenant } from '@/components/tenant/TenantProvider'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type InvoiceSummary = {
  id: string
  invoice_number: string
  status: string
  total: number
  deposit_amount: number
  balance_amount: number
  paid_total: number
  currency_code?: string | null
}

type SharePurpose = 'deposit' | 'balance'

type LastShare = {
  purpose: SharePurpose
  url: string
  text: string
  waHref: string | null
}

export default function QuoteInvoicePanel({
  quoteId,
  canManage,
  language,
  quoteAccepted,
  customerPhone,
  customerName,
  quoteNumber,
  currencyCode,
}: {
  quoteId: string
  canManage: boolean
  language?: string | null
  quoteAccepted: boolean
  customerPhone?: string | null
  customerName?: string | null
  quoteNumber?: string | null
  currencyCode?: string | null
}) {
  const locale: QuoteLanguage = language === 'en' || language === 'es' ? language : 'pt'
  const { company } = useTenant()
  const companyDisplayName =
    resolveTenantCompanyDisplayName(company) || 'Catering AI'
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastShare, setLastShare] = useState<LastShare | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showUrl, setShowUrl] = useState(false)

  const phoneDigits = paymentSharePhoneDigits(customerPhone)
  const phoneLabel = formatWhatsAppPhoneDisplay(customerPhone)
  const phoneOk = Boolean(phoneDigits)

  useEffect(() => {
    void fetch(`/api/quotes/${quoteId}/invoice`)
      .then((response) => response.json())
      .then((result) => {
        if (result?.data) setInvoice(result.data)
      })
      .catch(() => null)
  }, [quoteId])

  const invoiceOutstanding = invoice
    ? Math.max(0, Math.round((invoice.total - invoice.paid_total) * 100) / 100)
    : 0
  const displayCurrency = invoice?.currency_code || currencyCode || 'USD'
  const firstName = customerFirstNameFromDisplayName(
    customerName && customerName !== CUSTOMER_DISPLAY_NAME_EMPTY
      ? customerName
      : '',
  )

  const shareAmounts = useMemo(() => {
    if (!invoice) return { deposit: 0, balance: 0 }
    const remainingDeposit = Math.max(
      0,
      Math.round((invoice.deposit_amount - invoice.paid_total) * 100) / 100,
    )
    return {
      deposit: Math.min(remainingDeposit, invoiceOutstanding),
      balance: invoiceOutstanding,
    }
  }, [invoice, invoiceOutstanding])

  if (!canManage && !invoice) return null

  async function generate() {
    if (!quoteAccepted) {
      setError(tPayments(locale, 'quoteNotAccepted'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/quotes/${quoteId}/invoice`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || tPayments(locale, 'generateError'))
      setInvoice(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : tPayments(locale, 'generateError'))
    } finally {
      setBusy(false)
    }
  }

  function buildShare(purpose: SharePurpose, url: string): LastShare {
    const amount = purpose === 'deposit' ? shareAmounts.deposit : shareAmounts.balance
    const text = buildPaymentShareMessage({
      locale,
      companyDisplayName,
      customerFirstName: firstName,
      quoteNumber: quoteNumber || invoice?.invoice_number,
      invoiceNumber: invoice?.invoice_number,
      purpose,
      amount,
      currency: displayCurrency,
      paymentUrl: url,
    }).text
    return {
      purpose,
      url,
      text,
      waHref: buildPaymentWhatsAppHref(customerPhone, text),
    }
  }

  async function createShare(purpose: SharePurpose): Promise<LastShare | null> {
    if (!invoice) return null
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || tPayments(locale, 'generateError'))
      const url = String(result.data?.url || '')
      const share = buildShare(purpose, url)
      setLastShare(share)
      return share
    } catch (err) {
      setError(err instanceof Error ? err.message : tPayments(locale, 'generateError'))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function sendWhatsApp(purpose: SharePurpose) {
    if (!phoneOk) return
    const share = await createShare(purpose)
    if (!share?.waHref) return
    const opened = window.open(share.waHref, '_blank', 'noopener,noreferrer')
    if (!opened) window.location.assign(share.waHref)
  }

  async function copyMessage() {
    const share = lastShare || (await createShare('deposit'))
    if (!share) {
      setCopied(tPayments(locale, 'generateShareFirst'))
      return
    }
    const ok =
      copyWhatsAppMessageSync(share.text) ||
      (await navigator.clipboard.writeText(share.text).then(() => true).catch(() => false))
    setCopied(ok ? tPayments(locale, 'paymentMessageCopied') : tCommon(locale, 'errorGeneric'))
  }

  async function copyLink() {
    const share = lastShare || (await createShare('deposit'))
    if (!share) {
      setCopied(tPayments(locale, 'generateShareFirst'))
      return
    }
    const ok =
      copyWhatsAppMessageSync(share.url) ||
      (await navigator.clipboard.writeText(share.url).then(() => true).catch(() => false))
    setCopied(ok ? tPayments(locale, 'paymentLinkCopied') : tCommon(locale, 'errorGeneric'))
  }

  const statusLabel =
    invoice?.status === 'paid'
      ? tPayments(locale, 'statusPaid')
      : invoice?.status === 'partially_paid'
        ? tPayments(locale, 'statusPartiallyPaid')
        : invoice?.status === 'canceled'
          ? tPayments(locale, 'statusCanceled')
          : tPayments(locale, 'statusAwaitingDeposit')

  const shareDisabled = busy || !invoice || invoice.status === 'paid' || invoice.status === 'canceled'
  const waDisabled = shareDisabled || !phoneOk

  return (
    <section
      data-invoice-panel
      data-last-wa-href={lastShare?.waHref || ''}
      data-last-payment-url={lastShare?.url || ''}
      className="no-print liquid-glass-card mt-4 space-y-4 p-5"
    >
      <h2 className="text-lg font-bold text-cdl-fg">{tPayments(locale, 'invoiceTitle')}</h2>
      {invoice ? (
        <div className="space-y-3 text-sm text-cdl-muted">
          <p data-invoice-number>
            {tPayments(locale, 'invoiceNumber', { number: invoice.invoice_number })}
          </p>
          <p>
            {tPayments(locale, 'paymentStatus')}: {statusLabel}
          </p>
          <p>
            {tPayments(locale, 'total')}: {displayCurrency} {invoice.total.toFixed(2)} ·{' '}
            {tPayments(locale, 'deposit')}: {displayCurrency} {invoice.deposit_amount.toFixed(2)} ·{' '}
            {tPayments(locale, 'paid')}: {displayCurrency} {invoice.paid_total.toFixed(2)} ·{' '}
            {tPayments(locale, 'invoiceOutstanding')}: {displayCurrency} {invoiceOutstanding.toFixed(2)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/invoices/${invoice.id}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase"
            >
              {tPayments(locale, 'view')} {tPayments(locale, 'invoiceTitle')}
            </Link>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="inline-flex min-h-11 items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase"
            >
              {tPayments(locale, 'downloadPdf')}
            </a>
          </div>

          {canManage ? (
            <div
              data-testid="quote-invoice-whatsapp"
              className="space-y-3 rounded-2xl border border-cdl-border bg-cdl-inset/40 p-4"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cdl-muted">
                {tPayments(locale, 'customerWhatsApp')}
              </p>
              {phoneOk ? (
                <p data-testid="customer-whatsapp-number" className="text-base font-bold text-cdl-fg">
                  {phoneLabel || `+${phoneDigits}`}
                </p>
              ) : (
                <p data-testid="customer-whatsapp-missing" className="text-sm font-semibold text-amber-700">
                  {tPayments(locale, 'missingCustomerWhatsApp')}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  data-testid="send-deposit-whatsapp"
                  disabled={waDisabled}
                  onClick={() => void sendWhatsApp('deposit')}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#128C7E] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40"
                >
                  {tPayments(locale, 'sendDepositWhatsApp')}
                </button>
                <button
                  type="button"
                  data-testid="send-balance-whatsapp"
                  disabled={waDisabled}
                  onClick={() => void sendWhatsApp('balance')}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#128C7E] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40"
                >
                  {tPayments(locale, 'sendBalanceWhatsApp')}
                </button>
                <button
                  type="button"
                  data-testid="copy-payment-message"
                  disabled={shareDisabled}
                  onClick={() => void copyMessage()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2.5 text-xs font-bold uppercase"
                >
                  {tPayments(locale, 'copyPaymentMessage')}
                </button>
                <button
                  type="button"
                  data-testid="copy-payment-link"
                  disabled={shareDisabled}
                  onClick={() => void copyLink()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2.5 text-xs font-bold uppercase"
                >
                  {tPayments(locale, 'copyLink')}
                </button>
              </div>
              {lastShare ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-cdl-fg">
                    {lastShare.purpose === 'deposit'
                      ? tPayments(locale, 'lastShareDeposit')
                      : tPayments(locale, 'lastShareBalance')}
                  </p>
                  <pre
                    data-testid="payment-share-preview"
                    className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-cdl-surface px-3 py-2 text-xs text-cdl-fg"
                  >
                    {lastShare.text}
                  </pre>
                  <button
                    type="button"
                    className="text-xs font-bold uppercase text-cdl-muted underline"
                    onClick={() => setShowUrl((current) => !current)}
                  >
                    {showUrl
                      ? tPayments(locale, 'hidePaymentUrl')
                      : tPayments(locale, 'showPaymentUrl')}
                  </button>
                  {showUrl ? (
                    <p data-testid="payment-share-url" className="break-all text-xs text-cdl-muted">
                      {lastShare.url}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {copied ? (
                <p className="text-xs font-semibold text-emerald-700" role="status">
                  {copied}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : canManage ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-primary-2,#1e3a5f)] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40"
        >
          {tPayments(locale, 'generateInvoice')}
        </button>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
