'use client'

import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function AdditionalsCategoryReviewPanel({
  language,
  total,
  remaining,
  complete,
  pendingLabels,
}: {
  language: QuoteLanguage
  total: number
  remaining: number
  complete: boolean
  pendingLabels: string[]
}) {
  if (total <= 0) return null

  return (
    <section
      className={`rounded-2xl border px-4 py-4 sm:px-5 ${
        complete
          ? 'border-cdl-success-border bg-cdl-success-soft'
          : 'border-cdl-warning-border bg-cdl-warning-soft'
      }`}
      aria-live="polite"
    >
      <p
        className={`text-sm font-semibold leading-relaxed ${
          complete ? 'text-cdl-success' : 'text-cdl-text-secondary'
        }`}
      >
        {complete
          ? tw(language, 'categoriesReviewComplete')
          : tw(language, 'categoriesReviewRequired', {
              remaining: String(remaining),
              total: String(total),
            })}
      </p>
      {!complete && pendingLabels.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cdl-muted">
            {tw(language, 'categoriesReviewPendingHeading')}
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-cdl-text-secondary">
            {pendingLabels.map((label) => (
              <li key={label} className="flex gap-2">
                <span className="text-cdl-warning" aria-hidden>
                  •
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
