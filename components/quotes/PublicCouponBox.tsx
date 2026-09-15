'use client'

import { useEffect, useMemo, useState } from 'react'
import { tCouponReason, tCoupons } from '@/Lib/i18n/coupons'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type Coupon = {
  code: string
  campaignName: string
  description: string | null
  manualApprovalRequired: boolean
  approvalStatus: 'pending' | 'applied' | 'rejected'
  eligibleAmount: number
  potentialDiscountAmount: number
  appliedDiscountAmount: number
  totalAfterCoupon: number
  projectedTotalAfterApproval: number
}

type ApiResponse = {
  coupon?: Coupon | null
  reason?: string
  pricing?: { subtotal: number; total: number; deposit: number; balance: number }
}

function formatMoney(value: number, currency: string, language: QuoteLanguage) {
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

export default function PublicCouponBox({
  language,
  currency,
  onPricingRefresh,
}: {
  language: QuoteLanguage
  currency: string
  onPricingRefresh: () => void
}) {
  const [code, setCode] = useState('')
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [pricing, setPricing] = useState<ApiResponse['pricing']>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const money = useMemo(
    () => (value: number) => formatMoney(value, currency, language),
    [currency, language],
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/public/coupons/preview', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) =>
        response.ok ? ((await response.json()) as ApiResponse) : null,
      )
      .then((result) => {
        if (!result?.coupon) return
        setCoupon(result.coupon)
        setPricing(result.pricing)
        setCode(result.coupon.code)
        setRemoved(false)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [])

  async function send(nextCode: string) {
    if (loading) return
    setLoading(true)
    setError(null)
    setRemoved(false)
    try {
      const response = await fetch('/api/public/coupons/preview', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: nextCode }),
      })
      const result = (await response.json().catch(() => null)) as ApiResponse | null
      if (!response.ok || (nextCode && !result?.coupon)) {
        setError(tCouponReason(language, result?.reason))
        if (!coupon) {
          setPricing(undefined)
        }
        return
      }
      setCoupon(result?.coupon ?? null)
      setPricing(result?.pricing)
      if (result?.coupon) {
        setCode(result.coupon.code)
        setRemoved(false)
      } else {
        setCode('')
        setRemoved(true)
        setPricing(undefined)
      }
      onPricingRefresh()
    } catch {
      setError(tCouponReason(language, 'invalid'))
    } finally {
      setLoading(false)
    }
  }

  const pending =
    Boolean(coupon) &&
    (coupon?.manualApprovalRequired === true || coupon?.approvalStatus === 'pending') &&
    coupon?.approvalStatus !== 'rejected'
  const applied =
    Boolean(coupon) &&
    !pending &&
    coupon?.approvalStatus !== 'rejected' &&
    Number(coupon?.appliedDiscountAmount ?? 0) > 0
  const rejected = coupon?.approvalStatus === 'rejected'
  const boxState = loading
    ? 'loading'
    : error
      ? 'invalid'
      : rejected
        ? 'rejected'
        : pending
          ? 'pending'
          : applied
            ? 'applied'
            : removed
              ? 'removed'
              : 'idle'

  return (
    <section
      data-public-coupon-box
      data-coupon-state={boxState}
      className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-surface shadow-cdl"
    >
      <div className="border-b border-cdl-border bg-gradient-to-r from-amber-50 via-cdl-surface to-cdl-surface px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl"
            aria-hidden
          >
            🎟️
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
              {tCoupons(language, 'publicEyebrow')}
            </p>
            <h3 className="mt-0.5 text-lg font-black text-cdl-title">
              {tCoupons(language, 'publicTitle')}
            </h3>
            <p className="mt-1 text-xs leading-5 text-cdl-muted">
              {tCoupons(language, 'publicSubtitle')}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            data-testid="public-coupon-input"
            aria-label={tCoupons(language, 'placeholder')}
            placeholder={tCoupons(language, 'placeholder')}
            onChange={(event) => {
              setCode(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9_-]/g, '')
                  .slice(0, 32),
              )
              setError(null)
              setRemoved(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void send(code.trim())
              }
            }}
            className="min-h-12 flex-1 rounded-xl border border-cdl-border bg-cdl-bg px-4 text-sm font-black uppercase tracking-[0.12em] text-cdl-title outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-cdl-faint focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/15 disabled:opacity-60"
          />
          <button
            type="button"
            data-testid="public-coupon-apply"
            disabled={loading || !code.trim()}
            onClick={() => void send(code.trim())}
            className="min-h-12 rounded-xl bg-cdl-title px-5 text-sm font-black text-cdl-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? tCoupons(language, 'checking') : tCoupons(language, 'apply')}
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            data-testid="public-coupon-error"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800"
          >
            {error}
          </p>
        ) : null}
        {removed && !coupon && !error ? (
          <p
            role="status"
            data-testid="public-coupon-removed"
            className="rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2.5 text-xs font-semibold text-cdl-muted"
          >
            {tCoupons(language, 'removed')}
          </p>
        ) : null}
        {rejected ? (
          <div
            data-testid="public-coupon-rejected"
            className="rounded-2xl border border-red-200 bg-red-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">
                {coupon?.code}
              </span>
              <span className="rounded-full bg-red-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-900">
                {tCoupons(language, 'rejected')}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-red-900">
              {tCoupons(language, 'rejectedText')}
            </p>
          </div>
        ) : null}
        {coupon && !rejected ? (
          <div
            data-testid={pending ? 'public-coupon-pending' : 'public-coupon-applied'}
            className={`rounded-2xl border p-4 ${
              pending ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">
                    {coupon.code}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                      pending ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {pending
                      ? tCoupons(language, 'pending')
                      : tCoupons(language, 'applied')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-cdl-title">
                  {pending
                    ? tCoupons(language, 'couponReceived')
                    : coupon.campaignName}
                </p>
                {coupon.description ? (
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-cdl-muted">
                    {coupon.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                data-testid="public-coupon-remove"
                disabled={loading}
                onClick={() => void send('')}
                className="text-xs font-bold text-cdl-muted underline underline-offset-2 hover:text-cdl-title"
              >
                {tCoupons(language, 'remove')}
              </button>
            </div>
            {pending ? (
              <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                {tCoupons(language, 'pendingText')}
              </p>
            ) : (
              <p className="mt-3 text-sm font-black text-emerald-800">
                {tCoupons(language, 'youSaved', {
                  amount: money(coupon.appliedDiscountAmount || coupon.potentialDiscountAmount),
                })}
              </p>
            )}
            {applied && pricing ? (
              <p className="mt-1 text-xs font-semibold text-cdl-muted">
                {tCoupons(language, 'deposit')}: {money(pricing.deposit)} ·{' '}
                {tCoupons(language, 'balance')}: {money(pricing.balance)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
