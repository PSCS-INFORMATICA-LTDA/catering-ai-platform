'use client'

import type { ReactNode } from 'react'
import { formatMoneyOrDash } from '@/Lib/readQuoteSnapshot'
import { formatMileageQuantity } from '@/Lib/units'
import { formatDate } from '@/app/quotes/[id]/quoteDetailTypes'
import type { QuoteReviewPackageSummary } from './quoteReviewPackageSummary'
import { tw } from '@/Lib/quoteTranslations'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function loc(language?: string | null): QuoteLanguage {
  return language === 'en' || language === 'es' ? language : 'pt'
}

export type QuoteFinancialLine = {
  label: string
  value: string
  emphasis?: boolean
  subtle?: boolean
  discount?: boolean
}

export function buildQuoteFinancialLines(input: {
  packageSummary?: QuoteReviewPackageSummary | null
  packageTotal: number | null
  additionalTotal: number | null
  mileageFee: number | null
  chargedMiles?: number | null
  mileageFreeLimit?: number | null
  grillRentalTotal?: number | null
  holidaySurchargeAmount?: number | null
  minimumOrderAdjustment?: number | null
  discountAmount?: number | null
  reservationAmount?: number | null
  quoteTotal: number | null
  language?: QuoteLanguage | string | null
}): QuoteFinancialLine[] {
  const language = loc(input.language)
  const lines: QuoteFinancialLine[] = []
  const summary = input.packageSummary

  if (summary?.hasGarnish) {
    if ((summary.packageTotalPrice ?? 0) > 0) {
      lines.push({
        label: tQuotesOrders(language, 'packageLabel'),
        value: formatMoneyOrDash(summary.packageTotalPrice),
      })
    }
    if ((summary.garnishTotalPrice ?? 0) > 0) {
      lines.push({
        label: tw(language, 'garnish'),
        value: formatMoneyOrDash(summary.garnishTotalPrice),
      })
    }
  } else if ((input.packageTotal ?? 0) > 0) {
    lines.push({
      label: tQuotesOrders(language, 'packageLabel'),
      value: formatMoneyOrDash(input.packageTotal),
    })
  }

  if ((input.additionalTotal ?? 0) > 0) {
    lines.push({
      label: tw(language, 'extrasOnQuote'),
      value: formatMoneyOrDash(input.additionalTotal),
    })
  }

  if ((input.mileageFee ?? 0) > 0) {
    const charged = Number(input.chargedMiles ?? 0)
    const free = Number(input.mileageFreeLimit ?? 20)
    lines.push({
      label:
        charged > 0
          ? tQuotesOrders(language, 'docMileageChargedSummaryLine', {
              charged: formatMileageQuantity(charged),
              free: formatMileageQuantity(free),
            })
          : tQuotesOrders(language, 'mileageLabel'),
      value: formatMoneyOrDash(input.mileageFee),
    })
  }

  if ((input.grillRentalTotal ?? 0) > 0) {
    lines.push({
      label: tQuotesOrders(language, 'docGrillRentalLine'),
      value: formatMoneyOrDash(input.grillRentalTotal),
    })
  }

  if ((input.holidaySurchargeAmount ?? 0) > 0) {
    lines.push({
      label: tQuotesOrders(language, 'docHolidaySurchargeLine'),
      value: formatMoneyOrDash(input.holidaySurchargeAmount),
    })
  }

  if ((input.minimumOrderAdjustment ?? 0) > 0.009) {
    lines.push({
      label: tw(language, 'minOrderAdjustment'),
      value: formatMoneyOrDash(input.minimumOrderAdjustment),
    })
  }

  if ((input.discountAmount ?? 0) > 0) {
    lines.push({
      label: tQuotesOrders(language, 'docDiscountLine'),
      value: formatMoneyOrDash(input.discountAmount),
      discount: true,
    })
  }

  lines.push({
    label: tw(language, 'total'),
    value: formatMoneyOrDash(input.quoteTotal),
    emphasis: true,
  })

  if ((input.reservationAmount ?? 0) > 0) {
    lines.push({
      label: tw(language, 'reservationDeposit'),
      value: formatMoneyOrDash(input.reservationAmount),
      subtle: true,
    })
  }

  return lines
}

export default function QuoteProposalOverviewCard({
  customerName,
  eventDate,
  addressLine,
  city,
  state,
  zipCode,
  packageSummary,
  packageTotal,
  additionalTotal,
  mileageFee,
  chargedMiles = null,
  mileageFreeLimit = null,
  grillRentalTotal = null,
  holidaySurchargeAmount = null,
  minimumOrderAdjustment = null,
  discountAmount = null,
  reservationAmount = null,
  quoteTotal,
  additionalsCount = 0,
  grillRentalRequired = false,
  afterClient,
  language = 'pt',
  showFinance = true,
}: {
  customerName: string
  eventDate: string | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  packageSummary?: QuoteReviewPackageSummary | null
  packageTotal: number | null
  additionalTotal: number | null
  mileageFee: number | null
  chargedMiles?: number | null
  mileageFreeLimit?: number | null
  grillRentalTotal?: number | null
  holidaySurchargeAmount?: number | null
  minimumOrderAdjustment?: number | null
  discountAmount?: number | null
  reservationAmount?: number | null
  quoteTotal: number | null
  additionalsCount?: number
  grillRentalRequired?: boolean | null
  /** Conteúdo após endereço e preço (ex.: aviso de mínimo comercial). */
  afterClient?: ReactNode
  language?: QuoteLanguage | string | null
  showFinance?: boolean
}) {
  const locale = loc(language)
  const cityState = [city, state].filter(Boolean).join(', ')
  const streetLine = [addressLine, zipCode].filter(Boolean).join(' · ')
  const financialLines = buildQuoteFinancialLines({
    packageSummary,
    packageTotal,
    additionalTotal,
    mileageFee,
    chargedMiles,
    mileageFreeLimit,
    grillRentalTotal,
    holidaySurchargeAmount,
    minimumOrderAdjustment,
    discountAmount,
    reservationAmount,
    quoteTotal,
    language: locale,
  })

  return (
    <div className="quote-proposal-overview quote-proposal-overview--enhanced">
      <div className="quote-proposal-overview-top">
        <div className="quote-proposal-overview-item">
          <span className="quote-proposal-label">
            {tQuotesOrders(locale, 'docCustomer')}
          </span>
          <p className="quote-proposal-value">{customerName || '—'}</p>
        </div>
        <div className="quote-proposal-overview-item">
          <span className="quote-proposal-label">
            {tQuotesOrders(locale, 'event')}
          </span>
          <p className="quote-proposal-value">{formatDate(eventDate, locale)}</p>
        </div>
      </div>

      <div className="quote-proposal-overview-location">
        <span className="quote-proposal-label">
          {tQuotesOrders(locale, 'docLocation')}
        </span>
        {cityState ? (
          <p className="quote-proposal-location-primary">{cityState}</p>
        ) : null}
        {streetLine ? (
          <p className="quote-proposal-location-secondary">{streetLine}</p>
        ) : !cityState ? (
          <p className="quote-proposal-location-secondary">—</p>
        ) : null}
      </div>

      {(packageSummary?.hasGarnish ||
        additionalsCount > 0 ||
        grillRentalRequired) && (
        <div className="quote-proposal-overview-badges">
          {packageSummary?.hasGarnish ? (
            <span className="quote-proposal-overview-badge">
              {tw(locale, 'withSides')}
            </span>
          ) : null}
          {additionalsCount > 0 ? (
            <span className="quote-proposal-overview-badge">
              {tw(locale, 'additionalCount', {
                count: additionalsCount,
                plural: additionalsCount !== 1 ? 's' : '',
              })}
            </span>
          ) : null}
          {grillRentalRequired ? (
            <span className="quote-proposal-overview-badge">
              {tw(locale, 'grillToRent')}
            </span>
          ) : null}
        </div>
      )}

      {showFinance ? (
        <div className="quote-proposal-overview-finance">
          <p className="quote-proposal-label">
            {tQuotesOrders(locale, 'docFinancialSection')}
          </p>
          <div className="quote-proposal-finance-lines">
            {financialLines.map((line) => (
              <div
                key={line.label}
                className={`quote-proposal-finance-row${
                  line.emphasis ? ' quote-proposal-finance-row--total' : ''
                }${line.subtle ? ' quote-proposal-finance-row--subtle' : ''}${
                  line.discount ? ' quote-proposal-finance-row--discount' : ''
                }`}
              >
                <span>{line.label}</span>
                <span>{line.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {afterClient ? (
        <div className="quote-proposal-overview-after-client mt-5 space-y-4">
          {afterClient}
        </div>
      ) : null}
    </div>
  )
}
