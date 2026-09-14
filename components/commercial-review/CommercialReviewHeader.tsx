import Link from 'next/link'
import {
  formatCurrency,
  type QuoteDetail,
} from '@/app/quotes/[id]/quoteDetailTypes'
import { quoteStatusLabel } from '@/Lib/i18n/quotesOrders'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import type { CommercialFinancialSummary } from '@/Lib/commercialReview/financialSummary'

export function CommercialReviewHeader({
  quote,
  locale,
  financial,
  shareBlocked,
}: {
  quote: QuoteDetail
  locale: string
  financial: CommercialFinancialSummary
  shareBlocked: boolean
}) {
  return (
    <header
      data-testid="commercial-review-header"
      className="rounded-3xl border border-cdl-border bg-cdl-surface p-4 shadow-sm sm:p-6"
    >
      <Link
        href="/quotes"
        prefetch={false}
        className="text-sm font-semibold text-cdl-muted hover:text-cdl-brand"
      >
        ← {tCommercialReview(locale, 'backToQuotes')}
      </Link>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-cdl-muted">
        {tCommercialReview(locale, 'title')}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cdl-title sm:text-3xl">
            {quote.quote_number ?? quote.id}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            {tCommercialReview(locale, 'subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            data-testid="commercial-review-status"
            className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white"
          >
            {quoteStatusLabel(quote.quote_status, locale)}
          </span>
          {shareBlocked ? (
            <span
              data-testid="commercial-review-share-gate"
              className="rounded-full bg-amber-200 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950"
            >
              {tCommercialReview(locale, 'couponPending')}
            </span>
          ) : null}
        </div>
      </div>
      <p
        data-testid="commercial-review-total"
        className="mt-4 text-3xl font-black tabular-nums text-cdl-title"
      >
        {formatCurrency(financial.total)}
      </p>
      <Link
        href={`/quotes/${quote.id}/edit?step=churrasqueira`}
        prefetch={false}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-cdl-border px-4 text-sm font-black uppercase tracking-wide"
      >
        {tCommercialReview(locale, 'editQuote')}
      </Link>
    </header>
  )
}
