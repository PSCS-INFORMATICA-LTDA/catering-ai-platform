import type { CommercialHistoryEvent } from '@/Lib/commercialReview/loadWorkspaceExtras'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { ReviewCard } from './ReviewCard'

export function CommercialHistory({
  locale,
  events,
}: {
  locale: string
  events: CommercialHistoryEvent[]
}) {
  return (
    <ReviewCard title={tCommercialReview(locale, 'history')} testId="commercial-review-history">
      {events.length === 0 ? (
        <p className="text-sm text-cdl-muted">{tCommercialReview(locale, 'historyEmpty')}</p>
      ) : (
        <ol className="grid gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-2xl border border-cdl-border bg-white px-3 py-2"
            >
              <p className="text-sm font-black text-cdl-title">{event.action}</p>
              <p className="mt-1 text-xs text-cdl-muted">
                {event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}
              </p>
            </li>
          ))}
        </ol>
      )}
    </ReviewCard>
  )
}
