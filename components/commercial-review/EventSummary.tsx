import {
  formatDate,
  formatTime,
  type QuoteDetail,
} from '@/app/quotes/[id]/quoteDetailTypes'
import { eventDurationMinutes } from '@/Lib/commercialReview/capacityOccupancy'
import { formatEventAddressLines } from '@/Lib/formatEventAddress'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { formatDistanceForDisplay } from '@/Lib/units'
import { ReviewCard, ReviewField } from './ReviewCard'

export function EventSummary({
  quote,
  locale,
}: {
  quote: QuoteDetail
  locale: string
}) {
  const children =
    Number(quote.children_under_3_count ?? 0) +
    Number(quote.children_4_to_12_count ?? 0)
  const duration = eventDurationMinutes(quote.start_time, quote.end_time)
  const hours = duration != null ? Math.floor(duration / 60) : 0
  const minutes = duration != null ? duration % 60 : 0
  const address = formatEventAddressLines({
    line: quote.address_line,
    city: quote.city,
    state: quote.state,
    zip: quote.postal_code ?? quote.zip_code,
  })
  const distance = formatDistanceForDisplay(quote.mileage_distance, 'both', {
    miles: '{mi} mi',
    kilometers: '{km} km',
    both: '{mi} mi / {km} km',
  })

  return (
    <ReviewCard title={tCommercialReview(locale, 'event')} testId="commercial-review-event">
      <dl className="grid gap-3 sm:grid-cols-2">
        <ReviewField
          label={tCommercialReview(locale, 'eventDate')}
          value={formatDate(quote.event_date, locale)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'startTime')}
          value={formatTime(quote.start_time)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'endTime')}
          value={formatTime(quote.end_time)}
        />
        <ReviewField
          label={tCommercialReview(locale, 'duration')}
          value={
            duration != null
              ? tCommercialReview(locale, 'durationHours', { hours, minutes })
              : '—'
          }
        />
        <ReviewField
          label={tCommercialReview(locale, 'adults')}
          value={quote.adult_count}
        />
        <ReviewField
          label={tCommercialReview(locale, 'children')}
          value={children}
        />
        <ReviewField
          label={tCommercialReview(locale, 'guestsTotal')}
          value={quote.physical_guest_count ?? Number(quote.adult_count ?? 0) + children}
          large
          testId="commercial-review-guests"
        />
        <ReviewField
          label={tCommercialReview(locale, 'eventType')}
          value={quote.event_name}
        />
        <ReviewField
          label={tCommercialReview(locale, 'address')}
          value={address.length ? address.join(', ') : '—'}
        />
        <ReviewField
          label={tCommercialReview(locale, 'distance')}
          value={distance}
        />
      </dl>
    </ReviewCard>
  )
}
