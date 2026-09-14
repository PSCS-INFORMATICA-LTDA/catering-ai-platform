'use client'

import { useState } from 'react'
import { tPublicOps } from '@/Lib/i18n/publicOps'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { formatUiDate, resolveDocumentLocale } from '@/Lib/i18n/locales'

type PublicQuote = {
  quote_number?: string | null
  quote_total?: number | null
  reservation_amount?: number | null
  balance_due?: number | null
  discount_amount?: number | null
  currency_code?: string | null
  package_label?: string | null
  adult_count?: number | null
  children_under_3_count?: number | null
  children_4_to_12_count?: number | null
  customer_name?: string | null
  event_name?: string | null
  event_date?: string | null
  language?: string | null
  coupon?: {
    code?: string | null
    approval_status?: string | null
    applied_discount_amount?: number | null
  } | null
}

function money(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value))
  } catch {
    return `$${Number(value).toFixed(2)}`
  }
}

export default function PublicProposalClient({
  token,
  companyName,
  initialResponse,
  canRespond,
  source = 'legacy_live_quote',
  sharedVersionId = null,
  quote,
}: {
  token: string
  companyName: string
  initialResponse: string
  canRespond: boolean
  source?: 'shared_version' | 'legacy_live_quote'
  sharedVersionId?: string | null
  quote: PublicQuote
}) {
  const lang = resolveDocumentLocale(quote.language)
  const [response, setResponse] = useState(initialResponse)
  const [allowed, setAllowed] = useState(canRespond)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function respond(action: 'accept' | 'reject') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/proposta/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = (await res.json()) as {
        data?: { proposal_response?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? tPublicOps(lang, 'respondError'))
      setResponse(
        json.data?.proposal_response ??
          (action === 'accept' ? 'accepted' : 'rejected'),
      )
      setAllowed(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tPublicOps(lang, 'genericError'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-cdl-bg px-4 py-10 text-cdl-fg">
      <div className="liquid-glass-card space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
            {tPublicOps(lang, 'proposalTitle')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-red-600">
            {companyName || 'BBQ At Home'}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            {tPublicOps(lang, 'quoteLabel', {
              number: quote.quote_number || '—',
            })}
          </p>
          <p
            data-testid="public-proposal-source"
            className="mt-2 hidden"
          >
            {source}
          </p>
          <p
            data-testid="public-proposal-version"
            className="hidden"
          >
            {sharedVersionId || ''}
          </p>
        </div>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'customer')}</dt>
            <dd className="font-semibold">{quote.customer_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'event')}</dt>
            <dd className="font-semibold">
              {quote.event_name || '—'} · {formatUiDate(quote.event_date, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'packageLabel')}
            </dt>
            <dd className="font-semibold">{quote.package_label || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'docPhysicalGuests')}
            </dt>
            <dd className="font-semibold">
              {tPublicOps(lang, 'guestsLine', {
                adults: quote.adult_count ?? 0,
                under3: quote.children_under_3_count ?? 0,
                kids: quote.children_4_to_12_count ?? 0,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'total')}</dt>
            <dd
              data-testid="public-proposal-total"
              className="text-xl font-bold text-cdl-fg"
            >
              {money(quote.quote_total, quote.currency_code ?? 'USD')}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'depositLabel')}</dt>
            <dd
              data-testid="public-proposal-deposit"
              className="font-semibold"
            >
              {money(quote.reservation_amount, quote.currency_code ?? 'USD')}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'balanceLabel')}</dt>
            <dd
              data-testid="public-proposal-balance"
              className="font-semibold"
            >
              {money(quote.balance_due, quote.currency_code ?? 'USD')}
            </dd>
          </div>
          {quote.coupon?.code ? (
            <div>
              <dt className="text-cdl-muted">{tPublicOps(lang, 'couponLabel')}</dt>
              <dd
                data-testid="public-proposal-coupon"
                className="font-semibold"
              >
                {quote.coupon.code}
                {quote.coupon.applied_discount_amount
                  ? ` · ${money(quote.coupon.applied_discount_amount, quote.currency_code ?? 'USD')}`
                  : ''}
              </dd>
            </div>
          ) : null}
        </dl>

        {sharedVersionId ? (
          <a
            data-testid="public-proposal-pdf"
            href={`/api/public/proposta/${token}/pdf`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cdl-border px-4 text-sm font-bold uppercase tracking-wider text-cdl-fg"
          >
            {tPublicOps(lang, 'downloadPdf')}
          </a>
        ) : null}

        {response === 'accepted' ? (
          <p className="rounded-xl border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {tPublicOps(lang, 'proposalAccepted')}
          </p>
        ) : null}
        {response === 'rejected' ? (
          <p className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {tPublicOps(lang, 'proposalRejected')}
          </p>
        ) : null}

        {allowed ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
              onClick={() => void respond('accept')}
            >
              {tPublicOps(lang, 'acceptProposal')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg disabled:opacity-60"
              onClick={() => void respond('reject')}
            >
              {tPublicOps(lang, 'rejectProposal')}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </main>
  )
}
