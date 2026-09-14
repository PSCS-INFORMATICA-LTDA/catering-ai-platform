import QuoteCouponDecisionCard from '@/components/quotes/QuoteCouponDecisionCard'
import { formatCurrency } from '@/app/quotes/[id]/quoteDetailTypes'
import type { CouponFinancialStory } from '@/Lib/coupons/couponFinancialStory'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { tCoupons } from '@/Lib/i18n/coupons'
import { ReviewCard } from './ReviewCard'

export function CouponSummary({
  quoteId,
  locale,
  canManage,
  story,
}: {
  quoteId: string
  locale: string
  canManage: boolean
  story: CouponFinancialStory | null
}) {
  if (story?.kind === 'pending') {
    return (
      <QuoteCouponDecisionCard
        quoteId={quoteId}
        locale={locale}
        canManage={canManage}
        story={story}
      />
    )
  }

  if (story?.kind === 'applied') {
    return (
      <ReviewCard title={tCommercialReview(locale, 'coupon')} testId="commercial-review-coupon-applied">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
          {tCommercialReview(locale, 'couponApplied')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">
            {story.code}
          </span>
          <span className="text-sm font-semibold text-cdl-muted">{story.campaignName}</span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-bold uppercase text-cdl-muted">
              {tCoupons(locale, 'youSaved').split('{amount}')[0] || tCommercialReview(locale, 'discount')}
            </dt>
            <dd className="mt-1 text-xl font-black tabular-nums text-emerald-700">
              −{formatCurrency(story.saved)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-cdl-muted">
              {tCommercialReview(locale, 'total')}
            </dt>
            <dd className="mt-1 text-xl font-black tabular-nums text-cdl-title">
              {formatCurrency(story.total)}
            </dd>
          </div>
        </dl>
      </ReviewCard>
    )
  }

  if (story?.kind === 'rejected') {
    return (
      <ReviewCard title={tCommercialReview(locale, 'coupon')} testId="commercial-review-coupon-rejected">
        <p className="text-sm font-black text-cdl-title">
          {tCommercialReview(locale, 'couponRejected')}
        </p>
        <p className="mt-2 font-mono text-sm font-bold">{story.code}</p>
        <p className="mt-2 text-sm text-cdl-muted">{tCoupons(locale, 'rejectedText')}</p>
      </ReviewCard>
    )
  }

  return (
    <ReviewCard title={tCommercialReview(locale, 'coupon')} testId="commercial-review-coupon-none">
      <p className="text-sm font-semibold text-cdl-muted">
        {tCommercialReview(locale, 'couponNone')}
      </p>
    </ReviewCard>
  )
}
