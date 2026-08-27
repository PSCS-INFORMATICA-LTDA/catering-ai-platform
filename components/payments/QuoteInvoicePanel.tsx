'use client'

import { useEffect, useState } from 'react'
import { tPayments } from '@/Lib/i18n/payments'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type InvoiceSummary = {
  id: string
  invoice_number: string
  status: string
  total: number
  deposit_amount: number
  balance_amount: number
  paid_total: number
}

export default function QuoteInvoicePanel({
  quoteId,
  canManage,
  language,
  quoteAccepted,
}: {
  quoteId: string
  canManage: boolean
  language?: string | null
  quoteAccepted: boolean
}) {
  const locale: QuoteLanguage = language === 'en' || language === 'es' ? language : 'pt'
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`/api/quotes/${quoteId}/invoice`)
      .then((response) => response.json())
      .then((result) => {
        if (result?.data) setInvoice(result.data)
      })
      .catch(() => null)
  }, [quoteId])

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

  async function createLink(purpose: 'deposit' | 'balance') {
    if (!invoice) return
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
      setLink(result.data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : tPayments(locale, 'generateError'))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    invoice?.status === 'paid'
      ? tPayments(locale, 'statusPaid')
      : invoice?.status === 'partially_paid'
        ? tPayments(locale, 'statusPartiallyPaid')
        : invoice?.status === 'canceled'
          ? tPayments(locale, 'statusCanceled')
          : tPayments(locale, 'statusAwaitingDeposit')

  return (
    <section
      data-invoice-panel
      className="no-print liquid-glass-card mt-4 space-y-3 p-5"
    >
      <h2 className="text-lg font-bold text-cdl-fg">{tPayments(locale, 'invoiceTitle')}</h2>
      {invoice ? (
        <div className="space-y-2 text-sm text-cdl-muted">
          <p data-invoice-number>
            {tPayments(locale, 'invoiceNumber', { number: invoice.invoice_number })}
          </p>
          <p>
            {tPayments(locale, 'paymentStatus')}: {statusLabel}
          </p>
          <p>
            {tPayments(locale, 'total')}: US${invoice.total.toFixed(2)} ·{' '}
            {tPayments(locale, 'deposit')}: US${invoice.deposit_amount.toFixed(2)} ·{' '}
            {tPayments(locale, 'paid')}: US${invoice.paid_total.toFixed(2)}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase"
            >
              {tPayments(locale, 'downloadPdf')}
            </a>
            {canManage && invoice.status !== 'paid' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createLink('deposit')}
                  className="rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase"
                >
                  {tPayments(locale, 'payDeposit')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createLink('balance')}
                  className="rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase"
                >
                  {tPayments(locale, 'payBalance')}
                </button>
              </>
            ) : null}
          </div>
          {link ? (
            <p className="break-all text-xs">
              {tPayments(locale, 'copyLink')}: {link}
            </p>
          ) : null}
        </div>
      ) : canManage ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="rounded-xl bg-[var(--brand-primary-2,#1e3a5f)] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40"
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
