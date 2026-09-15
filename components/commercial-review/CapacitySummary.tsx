import type { CapacityOccupancy } from '@/Lib/commercialReview/capacityOccupancy'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { ReviewCard, ReviewField } from './ReviewCard'

const STATE_CLASS: Record<CapacityOccupancy['state'], string> = {
  available: 'bg-emerald-100 text-emerald-900',
  attention: 'bg-amber-200 text-amber-950',
  blocked: 'bg-red-100 text-red-800',
  unknown: 'bg-neutral-200 text-neutral-800',
}

export function CapacitySummary({
  locale,
  capacity,
}: {
  locale: string
  capacity: CapacityOccupancy
}) {
  const label =
    capacity.state === 'available'
      ? tCommercialReview(locale, 'capacityAvailable')
      : capacity.state === 'attention'
        ? tCommercialReview(locale, 'capacityAttention')
        : capacity.state === 'blocked'
          ? tCommercialReview(locale, 'capacityBlocked')
          : tCommercialReview(locale, 'capacityUnknown')

  return (
    <ReviewCard
      title={tCommercialReview(locale, 'capacity')}
      testId="commercial-review-capacity"
      highlight={capacity.state === 'attention' || capacity.state === 'blocked'}
    >
      <span
        data-testid="commercial-review-capacity-state"
        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${STATE_CLASS[capacity.state]}`}
      >
        {label}
      </span>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReviewField
          label={tCommercialReview(locale, 'capacityConfigured')}
          value={capacity.capacity}
          testId="commercial-review-capacity-configured"
        />
        <ReviewField
          label={tCommercialReview(locale, 'capacityReserved')}
          value={capacity.reservedCount}
          testId="commercial-review-capacity-reserved"
        />
        <ReviewField
          label={tCommercialReview(locale, 'capacityThisQuote')}
          value={
            capacity.thisQuoteReserved
              ? tCommercialReview(locale, 'capacityReservedHere')
              : tCommercialReview(locale, 'capacityNotReserved')
          }
        />
      </dl>
      <p className="mt-3 text-xs text-cdl-muted">
        {tCommercialReview(locale, 'capacityReadOnly')}
      </p>
    </ReviewCard>
  )
}
