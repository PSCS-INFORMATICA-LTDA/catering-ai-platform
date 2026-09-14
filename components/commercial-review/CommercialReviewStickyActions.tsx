'use client'

import { tCommercialReview } from '@/Lib/i18n/commercialReview'

export function CommercialReviewStickyActions({
  locale,
  shareBlocked,
}: {
  locale: string
  shareBlocked: boolean
}) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      data-testid="commercial-review-sticky"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-cdl-border bg-white/95 p-3 backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-3xl gap-2">
        <button
          type="button"
          onClick={() => scrollTo('commercial-review-financial')}
          className="min-h-11 flex-1 rounded-xl border border-cdl-border text-xs font-black uppercase"
        >
          {tCommercialReview(locale, 'stickyReview')}
        </button>
        <button
          type="button"
          onClick={() => scrollTo('commercial-review-proposal')}
          className="min-h-11 flex-1 rounded-xl bg-neutral-900 text-xs font-black uppercase text-white"
        >
          {shareBlocked
            ? tCommercialReview(locale, 'couponPending')
            : tCommercialReview(locale, 'share')}
        </button>
      </div>
    </div>
  )
}
