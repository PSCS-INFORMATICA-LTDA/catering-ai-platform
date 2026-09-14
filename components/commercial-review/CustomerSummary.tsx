import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { tCommon } from '@/Lib/i18n/common'
import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import { ReviewCard, ReviewField } from './ReviewCard'

export function CustomerSummary({
  quote,
  locale,
}: {
  quote: QuoteDetail
  locale: string
}) {
  return (
    <ReviewCard title={tCommercialReview(locale, 'customer')} testId="commercial-review-customer">
      <dl className="grid gap-3 sm:grid-cols-2">
        <ReviewField
          label={tCommon(locale, 'name')}
          value={getCustomerDisplayNameFromQuote(quote)}
        />
        <ReviewField label={tCommon(locale, 'email')} value={quote.email} />
        <ReviewField label={tCommon(locale, 'phone')} value={quote.phone} />
        <ReviewField
          label={tCommercialReview(locale, 'customerId')}
          value={quote.customer_id}
          testId="commercial-review-customer-id"
        />
        <ReviewField
          label={tCommercialReview(locale, 'company')}
          value={quote.company_name}
        />
        <ReviewField
          label={tCommercialReview(locale, 'preferredLanguage')}
          value={(quote.language ?? 'pt').toUpperCase()}
        />
      </dl>
      <p className="mt-3 text-xs text-cdl-muted">
        {tCommercialReview(locale, 'pscsPartyReady')}
      </p>
    </ReviewCard>
  )
}
