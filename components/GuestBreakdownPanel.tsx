import type { GuestCounts } from '@/Lib/calculateQuoteTotals'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function StatCard({
  label,
  value,
  highlight,
  money,
}: {
  label: string
  value: React.ReactNode
  highlight?: boolean
  money?: boolean
}) {
  return (
    <div
      className={`cdl-metric-card rounded-xl border px-3 py-4 shadow-cdl sm:px-4 sm:py-5 ${
        highlight
          ? 'border-cdl-accent-border bg-cdl-accent/10'
          : 'border-cdl-border bg-cdl-inset'
      }`}
    >
      <p className="cdl-eyebrow leading-snug">{label}</p>
      <p
        className={`cdl-metric-value ${
          money ? 'cdl-metric-value--money' : ''
        } ${highlight ? 'cdl-metric-value--emphasis text-cdl-price' : 'text-cdl-price'}`}
      >
        {value}
      </p>
    </div>
  )
}

type SnapshotTotals = {
  billableGuestCount: number | null
  physicalGuestCount: number | null
  quoteTotal: number | null
}

function formatCount(value: number | null) {
  return value == null ? '—' : value
}

function formatQuoteTotal(value: number | null) {
  return value == null ? '—' : `$${value.toFixed(2)}`
}

export default function GuestBreakdownPanel({
  guestCounts,
  totals,
  variant = 'default',
  language = 'pt',
  showFinancialTotal = true,
}: {
  guestCounts: GuestCounts
  totals: SnapshotTotals
  variant?: 'default' | 'compact' | 'pdf'
  language?: QuoteLanguage | string | null
  showFinancialTotal?: boolean
}) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  const gridClass =
    variant === 'compact'
      ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'
      : 'grid grid-cols-2 gap-3 sm:grid-cols-3'

  const cards = (
    <>
      <StatCard label={tw(loc, 'adults')} value={guestCounts.adultCount} />
      <StatCard
        label={tw(loc, 'childrenUnder3')}
        value={guestCounts.childrenUnder3Count}
      />
      <StatCard
        label={tw(loc, 'children4to12')}
        value={guestCounts.children4To12Count}
      />
      <StatCard
        label={tw(loc, 'physicalGuests')}
        value={formatCount(totals.physicalGuestCount)}
      />
      <StatCard
        label={tw(loc, 'billedPeople')}
        value={formatCount(totals.billableGuestCount)}
        highlight
      />
      {showFinancialTotal ? (
        <StatCard
          label={tw(loc, 'financialTotal')}
          value={formatQuoteTotal(totals.quoteTotal)}
          highlight
          money
        />
      ) : null}
    </>
  )

  if (variant === 'compact') {
    return <div className={gridClass}>{cards}</div>
  }

  return (
    <div className="space-y-4">
      <div className={gridClass}>{cards}</div>

      <p className="text-sm leading-relaxed text-cdl-text-secondary">
        {tw(loc, 'guestRule')}
      </p>
    </div>
  )
}
