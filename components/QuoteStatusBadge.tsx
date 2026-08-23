import {
  deriveGrillPhotoStatus,
  getGrillPhotoBadgeLabel,
} from '@/Lib/grillPhotoStatus'
import { quoteStatusLabel, tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { tw } from '@/Lib/quoteTranslations'

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-cdl-border bg-cdl-inset text-cdl-text-secondary',
  sent: 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand',
  approved: 'border-cdl-success-border bg-cdl-success-soft text-cdl-success',
  cancelled: 'border-red-300/40 bg-red-500/10 text-red-400',
  canceled: 'border-red-300/40 bg-red-500/10 text-red-400',
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? 'draft').trim().toLowerCase()
}

export function getQuoteStatusLabel(
  status: string | null | undefined,
  locale: string | null | undefined = 'pt',
) {
  return quoteStatusLabel(status, locale)
}

export default function QuoteStatusBadge({
  status,
  locale = 'pt',
}: {
  status: string | null | undefined
  locale?: string | null
}) {
  const key = normalizeStatus(status)
  const className =
    STATUS_STYLES[key] ?? 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${className}`}
    >
      {getQuoteStatusLabel(status, locale)}
    </span>
  )
}

export function QuoteBoolBadge({
  label,
  value,
  variant = 'default',
  hasGrill,
  locale = 'pt',
}: {
  label: string
  value: boolean | null | undefined
  variant?: 'default' | 'photo'
  hasGrill?: boolean | null
  locale?: string | null
}) {
  let text = '—'
  let className = 'border-cdl-border bg-cdl-inset text-cdl-muted'

  if (variant === 'photo') {
    if (hasGrill === false) {
      text = tQuotesOrders(locale, 'grillPhotoNotApplicable')
      className = 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
    } else if (value === true) {
      text = tQuotesOrders(locale, 'grillPhotoPending')
      className = 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning'
    } else if (value === false && hasGrill === true) {
      text = tQuotesOrders(locale, 'grillPhotoReceived')
      className = 'border-cdl-success-border bg-cdl-success-soft text-cdl-success'
    } else if (value === false) {
      text = tQuotesOrders(locale, 'grillPhotoNotApplicable')
      className = 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
    }
  } else if (value === true) {
    text = tw(locale, 'yes')
    className = 'border-cdl-success-border bg-cdl-success-soft text-cdl-success'
  } else if (value === false) {
    text = tw(locale, 'no')
    className = 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${className}`}
    >
      {label}: {text}
    </span>
  )
}

export function QuoteGrillPhotoBadge({
  hasGrill,
  grillPhotoRequired,
  grillPhotoUrl,
  grillPhotoMediaId,
  locale = 'pt',
}: {
  hasGrill?: boolean | null
  grillPhotoRequired?: boolean | null
  grillPhotoUrl?: string | null
  grillPhotoMediaId?: string | null
  locale?: string | null
}) {
  const status = deriveGrillPhotoStatus({
    hasGrill,
    grillPhotoRequired,
    grillPhotoUrl,
    grillPhotoMediaId,
  })
  const text = getGrillPhotoBadgeLabel(status, locale)

  let className = 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
  if (status === 'pending') {
    className = 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning'
  } else if (status === 'received') {
    className = 'border-cdl-success-border bg-cdl-success-soft text-cdl-success'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${className}`}
    >
      {tw(locale, 'photoShort')}: {text}
    </span>
  )
}
