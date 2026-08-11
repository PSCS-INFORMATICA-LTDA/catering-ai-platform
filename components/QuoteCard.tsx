'use client'

import Link from 'next/link'
import DeleteQuoteButton from '@/components/DeleteQuoteButton'
import PackageBadge from '@/components/PackageBadge'
import {
  deriveGrillPhotoStatus,
  getGrillPhotoBadgeLabel,
} from '@/Lib/grillPhotoStatus'
import type { QuoteListItem } from '@/Lib/fetchQuoteList'
import { QuoteBoolBadge, QuoteGrillPhotoBadge } from './QuoteStatusBadge'
import QuoteStatusBadge from './QuoteStatusBadge'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { formatUiDate } from '@/Lib/i18n/locales'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { tw } from '@/Lib/quoteTranslations'

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toFixed(2)}`
}

function formatDate(
  value: string | null | undefined,
  locale: string | null | undefined,
) {
  return formatUiDate(value, locale)
}

function formatLocation(city: string | null, state: string | null) {
  const label = [city, state].filter(Boolean).join(', ')
  return label || '—'
}

function formatShortLocation(city: string | null, state: string | null) {
  const cityLabel = city?.trim()
  const stateLabel = state?.trim()
  if (cityLabel && stateLabel) return `${cityLabel}, ${stateLabel}`
  return cityLabel || stateLabel || '—'
}

function formatMiles(value: number | null | undefined) {
  if (value == null) return '0 mi'
  return `${Number(value)} mi`
}

function Metric({
  label,
  value,
  money,
  highlight,
}: {
  label: string
  value: string
  money?: boolean
  highlight?: boolean
}) {
  return (
    <div className="quote-card-metric rounded-xl border border-[var(--brand-border)]/80 bg-[#f6f7f9] px-3 py-2.5">
      <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--brand-text-muted)]">
        {label}
      </p>
      <p
        className={`quote-card-metric-value mt-1 text-sm font-bold leading-tight ${
          money ? 'quote-card-metric-value--money' : ''
        } ${highlight ? 'quote-pscs-total font-black' : 'text-[var(--brand-text)]'}`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}


function CompactIndicator({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-cdl-success-border bg-cdl-success-soft text-cdl-success'
      : tone === 'warning'
        ? 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning'
        : 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-[0.58rem] font-bold uppercase tracking-wide ${toneClass}`}
    >
      {label}: {value}
    </span>
  )
}

function getCompactPhotoIndicator(
  quote: QuoteListItem,
  locale: string | null | undefined,
) {
  const status = deriveGrillPhotoStatus({
    hasGrill: quote.has_grill,
    grillPhotoRequired: quote.grill_photo_required,
  })
  const label = getGrillPhotoBadgeLabel(status, locale)
  const tone =
    status === 'received'
      ? 'success'
      : status === 'pending'
        ? 'warning'
        : 'neutral'
  return { label, tone } as const
}

function QuoteCardActions({
  quote,
  onDeleted,
  className = '',
}: {
  quote: QuoteListItem
  onDeleted?: (quoteId: string) => void
  className?: string
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:flex sm:flex-wrap ${className}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Link
        href={`/quotes/${quote.id}`}
        className="pscs-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider sm:min-w-[4.5rem]"
      >
        Ver
      </Link>
      <Link
        href={`/quotes/${quote.id}/edit?step=churrasqueira`}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--brand-border)] bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] transition-colors hover:border-[var(--brand-primary-2)]"
      >
        Editar
      </Link>
      <DeleteQuoteButton
        quoteId={quote.id}
        compact
        redirectToList={false}
        onDeleted={onDeleted}
      />
      <Link
        href={`/quotes/${quote.id}?pdf=1`}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--brand-border)] bg-[#f6f7f9] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary-2)]"
      >
        PDF
      </Link>
    </div>
  )
}

function QuoteCardCompactSummary({
  quote,
  onToggle,
}: {
  quote: QuoteListItem
  onToggle: () => void
}) {
  const locale = useAuthLocaleFromMe()
  const photo = getCompactPhotoIndicator(quote, locale)

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-cdl-accent-border"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black leading-tight text-cdl-title">
            {quote.customer_name}
          </h2>
          <p className="mt-1 text-sm text-cdl-text-secondary">
            {formatDate(quote.event_date, locale)}
          </p>
          <p className="mt-0.5 truncate text-xs text-cdl-muted">
            {formatShortLocation(quote.city, quote.state)}
          </p>
        </div>
        <QuoteStatusBadge status={quote.quote_status} locale={locale} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <PackageBadge name={quote.package_name} compact />
        <span className="quote-pscs-total text-sm font-black">
          {formatMoney(quote.quote_total)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <CompactIndicator
          label={tw(locale, 'additionalShort')}
          value={quote.has_additionals ? tw(locale, 'yes') : tw(locale, 'no')}
        />
        <CompactIndicator
          label={tw(locale, 'grillShort')}
          value={quote.has_grill ? tw(locale, 'yes') : tw(locale, 'no')}
        />
        <CompactIndicator
          label={tw(locale, 'photoShort')}
          value={photo.label}
          tone={photo.tone}
        />
      </div>
    </button>
  )
}

export default function QuoteCard({
  quote,
  onDeleted,
  expanded = false,
  onToggleExpand,
  mobileCompact = false,
}: {
  quote: QuoteListItem
  onDeleted?: (quoteId: string) => void
  expanded?: boolean
  onToggleExpand?: () => void
  mobileCompact?: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const showCompact = mobileCompact && !expanded

  if (showCompact) {
    return (
      <article className="quote-pscs-card overflow-hidden rounded-2xl p-3.5 transition-colors active:border-[var(--brand-primary-2)]">
        <QuoteCardCompactSummary quote={quote} onToggle={() => onToggleExpand?.()} />
        <button
          type="button"
          onClick={() => onToggleExpand?.()}
          className="mt-3 w-full min-h-[44px] rounded-xl border border-[var(--brand-border)] bg-[#f6f7f9] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary-2)] transition-colors hover:border-[var(--brand-primary)]"
        >
          {tw(locale, 'details')}
        </button>
      </article>
    )
  }

  return (
    <article
      className={`quote-pscs-card group flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-lg ${
        mobileCompact ? 'p-3.5' : 'p-4 sm:p-5'
      }`}
    >
      {mobileCompact ? (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-cdl-border-subtle pb-3">
          <p className="truncate text-[0.65rem] font-bold uppercase tracking-wider text-cdl-muted">
            {quote.quote_number}
          </p>
          <button
            type="button"
            onClick={() => onToggleExpand?.()}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wider text-cdl-brand"
          >
            {tw(locale, 'lessDetails')}
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[0.65rem] font-bold uppercase tracking-wider text-cdl-muted">
            {quote.quote_number}
          </p>
          <QuoteStatusBadge status={quote.quote_status} locale={locale} />
        </div>
      )}

      {!mobileCompact ? (
        <>
          <h2 className="mt-2 truncate text-lg font-black leading-tight text-cdl-title sm:text-xl">
            {quote.customer_name}
          </h2>
          <PackageBadge name={quote.package_name} />
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black leading-tight text-cdl-title">
                {quote.customer_name}
              </h2>
              <div className="mt-2">
                <PackageBadge name={quote.package_name} />
              </div>
            </div>
            <QuoteStatusBadge status={quote.quote_status} locale={locale} />
          </div>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          label={tQuotesOrders(locale, 'tableDate')}
          value={formatDate(quote.event_date, locale)}
        />
        <Metric
          label={tQuotesOrders(locale, 'locationLabel')}
          value={formatLocation(quote.city, quote.state)}
        />
        <Metric
          label={tw(locale, 'total')}
          value={formatMoney(quote.quote_total)}
          money
          highlight
        />
        <Metric
          label={tQuotesOrders(locale, 'reservationLabel')}
          value={formatMoney(quote.reservation_amount)}
          money
        />
        <Metric
          label={tQuotesOrders(locale, 'docBalanceDueLine')}
          value={formatMoney(quote.balance_due)}
          money
        />
        <Metric
          label={tw(locale, 'physicalGuests')}
          value={
            quote.physical_guest_count != null
              ? String(quote.physical_guest_count)
              : '—'
          }
        />
        <Metric
          label={tw(locale, 'billed')}
          value={
            quote.billable_guest_count != null
              ? String(quote.billable_guest_count)
              : '—'
          }
        />
        <Metric
          label={tw(locale, 'miles')}
          value={formatMiles(quote.mileage_distance)}
        />
        <Metric
          label={tw(locale, 'mileageFeeShort')}
          value={formatMoney(quote.mileage_fee)}
          money
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <QuoteBoolBadge
          label={tw(locale, 'additionalShort')}
          value={quote.has_additionals}
          locale={locale}
        />
        <QuoteBoolBadge
          label={tw(locale, 'grillShort')}
          value={quote.has_grill}
          locale={locale}
        />
        <QuoteGrillPhotoBadge
          hasGrill={quote.has_grill}
          grillPhotoRequired={quote.grill_photo_required}
          locale={locale}
        />
      </div>

      <QuoteCardActions
        quote={quote}
        onDeleted={onDeleted}
        className="mt-auto pt-4"
      />
    </article>
  )
}
