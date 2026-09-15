'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/app/quotes/[id]/quoteDetailTypes'
import type { CouponFinancialStory } from '@/Lib/coupons/couponFinancialStory'
import { decideCouponApplicationClient } from '@/Lib/coupons/decideCouponApplicationClient'
import { tCoupons } from '@/Lib/i18n/coupons'

type PendingStory = Extract<CouponFinancialStory, { kind: 'pending' }>

async function loadPendingApplicationId(quoteId: string) {
  const response = await fetch('/api/coupons/applications', { cache: 'no-store' })
  const result = (await response.json().catch(() => ({}))) as {
    applications?: Array<{ id?: string; quote_id?: string }>
    error?: string
  }
  if (!response.ok) {
    throw new Error(result.error || 'load')
  }
  const match = (result.applications ?? []).find((row) => String(row.quote_id) === quoteId)
  return typeof match?.id === 'string' ? match.id : null
}

export default function QuoteCouponDecisionCard({
  quoteId,
  locale,
  canManage,
  story,
}: {
  quoteId: string
  locale: string
  canManage: boolean
  story: PendingStory
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(action: 'approve' | 'reject') {
    if (!canManage) return
    if (!window.confirm(action === 'approve' ? tCoupons(locale, 'confirmApprove') : tCoupons(locale, 'confirmReject'))) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const applicationId = await loadPendingApplicationId(quoteId)
      if (!applicationId) throw new Error(tCoupons(locale, 'decideError'))
      const result = await decideCouponApplicationClient(applicationId, action)
      if (!result.ok) {
        throw new Error(result.data.error || tCoupons(locale, 'decideError'))
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCoupons(locale, 'decideError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      data-testid="coupon-quote-decision"
      data-quote-id={quoteId}
      className="no-print rounded-3xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:p-5"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
        {tCoupons(locale, 'pendingEyebrow')}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-cdl-title">{tCoupons(locale, 'quoteReviewDecisionTitle')}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">
              {story.code}
            </span>
            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950">
              {tCoupons(locale, 'pending')}
            </span>
          </div>
          {story.campaignName ? (
            <p className="mt-2 text-sm font-semibold text-cdl-muted">{story.campaignName}</p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-cdl-border bg-white px-3 py-3">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-cdl-muted">
            {tCoupons(locale, 'currentPayable')}
          </dt>
          <dd data-testid="coupon-quote-payable" className="mt-1 text-lg font-black tabular-nums text-cdl-title">
            {formatCurrency(story.currentPayable)}
          </dd>
        </div>
        <div className="rounded-2xl border border-cdl-border bg-white px-3 py-3">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-cdl-muted">
            {tCoupons(locale, 'requestedDiscount')}
          </dt>
          <dd data-testid="coupon-quote-requested" className="mt-1 text-lg font-black tabular-nums text-emerald-700">
            −{formatCurrency(story.requestedDiscount)}
          </dd>
        </div>
        <div className="rounded-2xl border border-dashed border-amber-400 bg-white px-3 py-3">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
            {tCoupons(locale, 'estimatedAfterApproval')}
          </dt>
          <dd data-testid="coupon-quote-projected" className="mt-1 text-lg font-black tabular-nums text-amber-950">
            {formatCurrency(story.projectedTotal)}
          </dd>
        </div>
      </dl>

      <p data-testid="coupon-quote-share-hint" className="mt-4 text-sm font-semibold text-amber-950">
        {tCoupons(locale, 'shareBlockedPending')}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      {canManage ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            data-testid="coupon-quote-reject"
            disabled={saving}
            onClick={() => void decide('reject')}
            className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 text-sm font-black text-red-700 disabled:opacity-50"
          >
            {tCoupons(locale, 'reject')}
          </button>
          <button
            type="button"
            data-testid="coupon-quote-approve"
            disabled={saving}
            onClick={() => void decide('approve')}
            className="min-h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-black text-white disabled:opacity-50"
          >
            {tCoupons(locale, 'approve')}
          </button>
        </div>
      ) : (
        <p data-testid="coupon-quote-readonly" className="mt-4 text-sm font-semibold text-amber-900">
          {tCoupons(locale, 'quoteReviewReadOnly')}
        </p>
      )}
    </section>
  )
}
