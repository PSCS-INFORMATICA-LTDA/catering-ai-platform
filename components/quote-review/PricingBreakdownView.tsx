'use client'

import type {
  PricingBreakdown,
  PricingBreakdownLine,
} from '@/Lib/pricing/pricingBreakdownTypes'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function formatCurrency(value: number) {
  return `$${Number(value).toFixed(2)}`
}

const GUEST_LINE_KEYS = new Set(['guest_billable', 'guest_physical'])

function lineLabel(
  lineKey: string,
  description: string,
  language: QuoteLanguage,
  variant: 'default' | 'confirmation',
): string {
  const map: Record<string, string> = {
    package: tw(language, 'breakdownPackage'),
    additional_item: tw(language, 'breakdownAdditional'),
    mileage: tw(language, 'breakdownMileage'),
    grill_rental: tw(language, 'breakdownGrillRental'),
    holiday_surcharge: tw(language, 'breakdownHoliday'),
    minimum_order: tw(language, 'breakdownMinimum'),
    discount: tw(language, 'breakdownDiscount'),
  }
  if (variant === 'confirmation' && map[lineKey]) return map[lineKey]
  if (description?.trim()) return description
  return map[lineKey] ?? lineKey
}

function shouldShowFormula(
  _lineKey: string,
  variant: 'default' | 'confirmation',
): boolean {
  return variant !== 'confirmation'
}

function confirmationChargeLines(
  breakdown: PricingBreakdown,
): PricingBreakdownLine[] {
  const result: PricingBreakdownLine[] = []

  for (const line of [...breakdown.lines, ...breakdown.adjustments]) {
    if (GUEST_LINE_KEYS.has(line.line_key)) continue

    if (line.line_key === 'additional_item') {
      const existingIndex = result.findIndex(
        (item) => item.line_key === 'additional_item',
      )
      if (existingIndex >= 0) {
        const existing = result[existingIndex]
        result[existingIndex] = {
          ...existing,
          quantity: existing.quantity + line.quantity,
          amount: existing.amount + line.amount,
        }
      } else {
        result.push({
          ...line,
          source_id: 'confirmation-additionals',
          description: '',
          formula: null,
        })
      }
      continue
    }

    if (
      line.amount !== 0 ||
      line.line_key === 'package' ||
      line.line_key === 'mileage'
    ) {
      result.push(line)
    }
  }

  return result
}

export default function PricingBreakdownView({
  breakdown,
  language,
  showDeposit = true,
  emphasizeTotal = false,
  variant = 'default',
}: {
  breakdown: PricingBreakdown
  language: QuoteLanguage
  showDeposit?: boolean
  emphasizeTotal?: boolean
  variant?: 'default' | 'confirmation'
}) {
  const allChargeLines =
    variant === 'confirmation'
      ? confirmationChargeLines(breakdown)
      : [...breakdown.lines, ...breakdown.adjustments].filter(
          (line) =>
            !GUEST_LINE_KEYS.has(line.line_key) &&
            (line.amount !== 0 || line.line_key === 'package'),
        )

  return (
    <div className="space-y-4">
      <div className="divide-y divide-cdl-border rounded-2xl border border-cdl-border bg-cdl-inset">
        {allChargeLines.map((line, index) => (
          <div
            key={`${line.line_key}-${line.source_id ?? index}`}
            className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-cdl-fg">
                {lineLabel(line.line_key, line.description, language, variant)}
              </p>
              {line.formula && shouldShowFormula(line.line_key, variant) ? (
                <p className="mt-0.5 text-xs text-cdl-muted">{line.formula}</p>
              ) : null}
            </div>
            <p
              className={`shrink-0 font-semibold tabular-nums ${
                line.amount < 0 ? 'text-cdl-success' : 'text-cdl-fg'
              }`}
            >
              {formatCurrency(line.amount)}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <p className="font-semibold text-cdl-muted">{tw(language, 'breakdownSubtotal')}</p>
          <p className="font-semibold tabular-nums text-cdl-fg">
            {formatCurrency(breakdown.subtotal)}
          </p>
        </div>
      </div>

      <div
        className={`rounded-2xl border px-5 py-4 ${
          emphasizeTotal
            ? 'border-cdl-accent-border bg-cdl-accent/5'
            : 'border-cdl-border bg-cdl-surface'
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
          {tw(language, 'totalToPay')}
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-cdl-price">
          {formatCurrency(breakdown.total)}
        </p>
      </div>

      {showDeposit ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-cdl-muted">
              {tw(language, 'breakdownDeposit')}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-cdl-fg">
              {formatCurrency(breakdown.deposit)}
            </p>
            {breakdown.rules_applied?.reservationPercentage != null ? (
              <p className="mt-1 text-xs text-cdl-muted">
                {tw(language, 'breakdownDepositPct', {
                  pct: String(breakdown.rules_applied.reservationPercentage),
                })}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-cdl-muted">
              {tw(language, 'breakdownBalance')}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-cdl-fg">
              {formatCurrency(breakdown.balance)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PricingPreviewStatus({
  loading,
  error,
  language,
}: {
  loading: boolean
  error: { message: string; code?: string } | null
  language: QuoteLanguage
}) {
  if (loading) {
    return (
      <p className="text-sm text-cdl-muted" role="status">
        {tw(language, 'pricingCalculating')}
      </p>
    )
  }
  if (error) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error.message || tw(language, 'pricingCalcError')}
      </p>
    )
  }
  return null
}
