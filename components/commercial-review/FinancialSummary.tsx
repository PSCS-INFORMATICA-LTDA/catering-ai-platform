import { formatCurrency } from '@/app/quotes/[id]/quoteDetailTypes'
import type { CommercialFinancialSummary } from '@/Lib/commercialReview/financialSummary'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { ReviewCard, ReviewField } from './ReviewCard'

export function FinancialSummary({
  locale,
  financial,
}: {
  locale: string
  financial: CommercialFinancialSummary
}) {
  return (
    <ReviewCard
      title={tCommercialReview(locale, 'financial')}
      testId="commercial-review-financial"
    >
      <p className="mb-3 text-xs font-semibold text-cdl-muted">
        {tCommercialReview(locale, 'serverOwned')}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <ReviewField
          label={tCommercialReview(locale, 'subtotal')}
          value={formatCurrency(financial.subtotal)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'additionals')}
          value={formatCurrency(financial.additionals)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'mileage')}
          value={formatCurrency(financial.mileage)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'otherCharges')}
          value={formatCurrency(financial.other)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'discount')}
          value={`−${formatCurrency(financial.discount)}`}
        />
        <ReviewField
          label={tCommercialReview(locale, 'total')}
          value={formatCurrency(financial.total)}
          large
          testId="commercial-review-financial-total"
        />
        <ReviewField
          label={tCommercialReview(locale, 'depositDue')}
          value={formatCurrency(financial.deposit)}
          large
          testId="commercial-review-deposit"
        />
        <ReviewField
          label={tCommercialReview(locale, 'balanceDue')}
          value={formatCurrency(financial.balance)}
          large
          testId="commercial-review-balance"
        />
      </dl>
    </ReviewCard>
  )
}
