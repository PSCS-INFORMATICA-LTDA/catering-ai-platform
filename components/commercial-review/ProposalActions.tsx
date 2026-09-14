'use client'

import { useState, type ReactNode } from 'react'
import QuotePdfDownload from '@/app/quotes/[id]/QuotePdfDownload'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { ReviewCard } from './ReviewCard'

export function ProposalActions({
  locale,
  quoteId,
  quoteNumber,
  customerName,
  eventDate,
  currentVersionId,
  currentVersionNumber,
  sharedVersionId,
  sharedAt,
  shareBlocked,
  sharePanel,
  proposalPreview,
}: {
  locale: string
  quoteId: string
  quoteNumber: string
  customerName?: string | null
  eventDate?: string | null
  currentVersionId?: string | null
  currentVersionNumber?: number | null
  sharedVersionId?: string | null
  sharedAt?: string | null
  shareBlocked: boolean
  sharePanel: ReactNode
  proposalPreview: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <ReviewCard title={tCommercialReview(locale, 'proposal')} testId="commercial-review-proposal">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-bold uppercase text-cdl-muted">
            {tCommercialReview(locale, 'proposalCurrentVersion')}
          </dt>
          <dd data-testid="commercial-review-current-version" className="mt-1 font-mono font-semibold">
            {currentVersionNumber != null
              ? `v${currentVersionNumber}`
              : '—'}
            {currentVersionId ? (
              <span className="mt-1 block text-[11px] text-cdl-muted">{currentVersionId}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase text-cdl-muted">
            {tCommercialReview(locale, 'proposalPinnedVersion')}
          </dt>
          <dd data-testid="commercial-review-shared-version" className="mt-1 font-mono font-semibold">
            {sharedVersionId ?? tCommercialReview(locale, 'proposalNotShared')}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase text-cdl-muted">
            {tCommercialReview(locale, 'proposalSharedAt')}
          </dt>
          <dd className="mt-1 font-semibold">{sharedAt ?? '—'}</dd>
        </div>
      </dl>

      {shareBlocked ? (
        <p className="mt-4 text-sm font-black text-amber-900">
          {tCommercialReview(locale, 'proposalPendingBlocked')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          data-testid="commercial-review-view-proposal"
          onClick={() => setOpen((value) => !value)}
          className="min-h-11 flex-1 rounded-xl border border-cdl-border bg-white px-4 text-sm font-black text-cdl-title"
        >
          {open
            ? tCommercialReview(locale, 'hideProposal')
            : tCommercialReview(locale, 'viewProposal')}
        </button>
        <QuotePdfDownload
          quoteId={quoteId}
          quoteNumber={quoteNumber}
          customerName={customerName}
          eventDate={eventDate}
        />
      </div>

      <div className="mt-4">{sharePanel}</div>
      {open ? (
        <div data-testid="commercial-review-proposal-preview" className="mt-6">
          {proposalPreview}
        </div>
      ) : null}
    </ReviewCard>
  )
}
