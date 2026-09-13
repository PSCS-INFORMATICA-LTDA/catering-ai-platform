'use client'

import { readCouponFinancialStory } from '@/Lib/coupons/couponFinancialStory'
import { tCoupons } from '@/Lib/i18n/coupons'
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
  const couponStory = readCouponFinancialStory(breakdown)

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

      {couponStory?.kind === 'applied' ? (
        <div
          data-testid="pricing-coupon-applied"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3"
        >
          <p className="text-sm font-black text-emerald-800">
            {tCoupons(language, 'youSaved', {
              amount: formatCurrency(couponStory.saved),
            })}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-900/80">
            {tCoupons(language, 'finalTotal')} {formatCurrency(couponStory.total)}
          </p>
        </div>
      ) : null}

      <div
        data-pricing-role="payable"
        data-testid="pricing-payable-total"
        className={`rounded-2xl border px-5 py-4 ${
          couponStory?.kind === 'pending'
            ? 'border-cdl-border bg-cdl-surface'
            : emphasizeTotal
              ? 'border-cdl-accent-border bg-cdl-accent/5'
            : 'border-cdl-border bg-cdl-surface'
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
          {couponStory?.kind === 'pending'
            ? tCoupons(language, 'currentPayable')
            : couponStory?.kind === 'applied'
              ? tCoupons(language, 'finalTotal')
              : tw(language, 'totalToPay')}
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-cdl-price">
          {formatCurrency(breakdown.total)}
        </p>
        {couponStory?.kind === 'pending' ? (
          <p className="mt-1 text-xs font-semibold text-cdl-muted">
            {tCoupons(language, 'currentPayableHint')}
          </p>
        ) : null}
      </div>

      {couponStory?.kind === 'pending' ? (
        <div
          data-pricing-role="projected"
          data-testid="pricing-coupon-pending"
          className="rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-5 py-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            {couponStory.code ? (
              <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-[11px] font-black tracking-wider text-amber-300">
                {couponStory.code}
              </span>
            ) : null}
            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950">
              {tCoupons(language, 'pending')}
            </span>
          </div>
          <p className="mt-3 text-sm font-black text-amber-950">
            {tCoupons(language, 'couponReceived')}
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-amber-900/80">
                {tCoupons(language, 'requestedDiscount')}
              </dt>
              <dd className="font-black tabular-nums text-emerald-800">
                -{formatCurrency(couponStory.requestedDiscount)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-amber-900/80">
                {tCoupons(language, 'estimatedAfterApproval')}
              </dt>
              <dd
                data-testid="pricing-projected-total"
                className="text-lg font-black tabular-nums text-amber-950"
              >
                {formatCurrency(couponStory.projectedTotal)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            {tCoupons(language, 'projectedNotPayable')}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
            {tCoupons(language, 'pendingText')}
          </p>
        </div>
      ) : null}

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
  onRetry,
}: {
  loading: boolean
  error: { message: string; code?: string } | null
  language: QuoteLanguage
  onRetry?: () => void
}) {
  if (loading) {
    return (
      <p className="text-sm text-cdl-muted" role="status">
        {tw(language, 'pricingCalculating')}
      </p>
    )
  }
  if (error) {
    const message =
      error.code === 'timeout'
        ? tw(language, 'pricingTimeout')
        : error.code === 'rate_limited'
          ? tw(language, 'pricingRateLimited')
          : error.message || tw(language, 'pricingCalcError')
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800"
        >
          {message}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-cdl-border px-4 py-2 text-sm font-bold"
          >
            {tw(language, 'pricingRetry')}
          </button>
        ) : null}
      </div>
    )
  }
  return null
}
