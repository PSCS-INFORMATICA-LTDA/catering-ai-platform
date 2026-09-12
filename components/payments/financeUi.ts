import { toBcp47Locale } from '@/Lib/i18n/locales'

export function formatFinanceMoney(
  value: number,
  currency: string,
  locale: string | null | undefined,
) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

export function formatFinanceDateTime(
  value: string | null | undefined,
  locale: string | null | undefined,
) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(toBcp47Locale(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export const INVOICE_STATUS_BADGE: Record<string, string> = {
  draft: 'border-cdl-border bg-cdl-inset text-cdl-text-secondary',
  ready: 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand',
  awaiting_deposit: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  partially_paid: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  paid: 'border-cdl-success-border bg-cdl-success-soft text-cdl-success',
  canceled: 'border-red-300/40 bg-red-500/10 text-red-500',
}

export function kindBadgeClass(kind: string) {
  return kind === 'post_event_adjustment'
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-sky-200 bg-sky-50 text-sky-800'
}
