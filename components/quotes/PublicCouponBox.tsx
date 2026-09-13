'use client'

import { useEffect, useMemo, useState } from 'react'
import { tCouponReason, tCoupons } from '@/Lib/i18n/coupons'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type Coupon = {
  code: string
  campaignName: string
  description: string | null
  manualApprovalRequired: boolean
  approvalStatus: 'pending' | 'applied'
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
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(Number(value || 0))
}

export default function PublicCouponBox({ language, currency, onPricingRefresh }: { language: QuoteLanguage; currency: string; onPricingRefresh: () => void }) {
  const [code, setCode] = useState('')
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [pricing, setPricing] = useState<ApiResponse['pricing']>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const money = useMemo(() => (value: number) => formatMoney(value, currency, language), [currency, language])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/public/coupons/preview', { method: 'GET', cache: 'no-store', signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as ApiResponse) : null))
      .then((result) => {
        if (!result?.coupon) return
        setCoupon(result.coupon)
        setPricing(result.pricing)
        setCode(result.coupon.code)
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
        return
      }
      setCoupon(result?.coupon ?? null)
      setPricing(result?.pricing)
      if (result?.coupon) setCode(result.coupon.code)
      else setCode('')
      onPricingRefresh()
    } catch {
      setError(tCouponReason(language, 'invalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section data-public-coupon-box className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-surface shadow-cdl">
      <div className="border-b border-cdl-border bg-gradient-to-r from-amber-50 via-cdl-surface to-cdl-surface px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl" aria-hidden>🎟️</div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">{tCoupons(language, 'publicEyebrow')}</p>
            <h3 className="mt-0.5 text-lg font-black text-cdl-title">{tCoupons(language, 'publicTitle')}</h3>
            <p className="mt-1 text-xs leading-5 text-cdl-muted">{tCoupons(language, 'publicSubtitle')}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            disabled={loading}
            autoComplete="off"
            aria-label={tCoupons(language, 'publicTitle')}
            placeholder={tCoupons(language, 'placeholder')}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32))
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void send(code.trim())
              }
            }}
            className="min-h-12 flex-1 rounded-xl border border-cdl-border bg-cdl-bg px-4 text-sm font-black uppercase tracking-[0.12em] text-cdl-title outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/15 disabled:opacity-60"
          />
          <button type="button" disabled={loading || !code.trim()} onClick={() => void send(code.trim())} className="min-h-12 rounded-xl bg-cdl-title px-5 text-sm font-black text-cdl-bg disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? tCoupons(language, 'checking') : tCoupons(language, 'apply')}
          </button>
        </div>
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800">{error}</p> : null}
        {coupon ? (
          <div className={`rounded-2xl border p-4 ${coupon.manualApprovalRequired ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">{coupon.code}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${coupon.manualApprovalRequired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}`}>
                    {coupon.manualApprovalRequired ? tCoupons(language, 'receivedPending') : tCoupons(language, 'applied')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-cdl-title">{coupon.campaignName}</p>
                {coupon.description ? <p className="mt-1 max-w-2xl text-xs leading-5 text-cdl-muted">{coupon.description}</p> : null}
              </div>
              <button type="button" disabled={loading} onClick={() => void send('')} className="text-xs font-bold text-cdl-muted underline underline-offset-2 hover:text-cdl-title">{tCoupons(language, 'remove')}</button>
            </div>
            {coupon.manualApprovalRequired ? <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">{tCoupons(language, 'pendingText')}</p> : null}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{tCoupons(language, 'subtotal')}</dt><dd className="mt-1 font-black text-cdl-title">{money(pricing?.subtotal ?? coupon.eligibleAmount)}</dd></div>
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{tCoupons(language, 'discount')}</dt><dd className="mt-1 font-black text-emerald-700">−{money(coupon.manualApprovalRequired ? coupon.potentialDiscountAmount : coupon.appliedDiscountAmount || coupon.potentialDiscountAmount)}</dd></div>
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{coupon.manualApprovalRequired ? tCoupons(language, 'projected') : tCoupons(language, 'total')}</dt><dd className="mt-1 font-black text-cdl-title">{money(coupon.manualApprovalRequired ? coupon.projectedTotalAfterApproval : coupon.totalAfterCoupon)}</dd></div>
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{tCoupons(language, 'deposit')}</dt><dd className="mt-1 font-black text-cdl-title">{money(pricing?.deposit ?? 0)}</dd>{!coupon.manualApprovalRequired ? <p className="mt-1 text-[10px] font-semibold text-cdl-muted">{tCoupons(language, 'balance')}: {money(pricing?.balance ?? 0)}</p> : null}</div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  )
}
