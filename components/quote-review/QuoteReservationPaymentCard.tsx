'use client'

import type { ReactNode } from 'react'
import {
  BALANCE_PERCENTAGE,
  RESERVATION_PERCENTAGE,
} from '@/Lib/cdlCommercialRules'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function loc(language?: string | null): QuoteLanguage {
  return language === 'en' || language === 'es' ? language : 'pt'
}

function emphasizePercents(text: string): ReactNode {
  return text.split(/(\d+\s*%)/g).map((part, index) =>
    /^\d+\s*%$/.test(part) ? (
      <strong key={`${part}-${index}`} className="quote-proposal-pct-mark">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

export default function QuoteReservationPaymentCard({
  language = 'pt',
  extraNotes,
  depositAmount,
  balanceAmount,
  reservationPercentage,
  ruleHint,
}: {
  language?: string | null
  extraNotes?: ReactNode
  depositAmount?: number | null
  balanceAmount?: number | null
  reservationPercentage?: number | null
  ruleHint?: string | null
}) {
  const locale = loc(language)
  const paymentText = tQuotesOrders(locale, 'docReservationPaymentText')
  const percent = reservationPercentage ?? RESERVATION_PERCENTAGE
  const balancePercent = Math.max(0, 100 - percent)
  const splitLine = `${tQuotesOrders(locale, 'reservationLabel')}: ${percent}% · ${tQuotesOrders(locale, 'docBalanceDueLine')}: ${balancePercent || BALANCE_PERCENTAGE}%`
  const hasAmounts =
    depositAmount != null &&
    balanceAmount != null &&
    !Number.isNaN(depositAmount) &&
    !Number.isNaN(balanceAmount)

  return (
    <section className="quote-proposal-section quote-proposal-reservation-card quote-print-section quote-proposal-section--compact">
      <h2 className="quote-proposal-section-title">
        {tQuotesOrders(locale, 'reservationLabel')}
      </h2>
      {hasAmounts ? (
        <div className="quote-proposal-reservation-amounts">
          <div className="quote-proposal-info-cell">
            <span className="quote-proposal-label">
              {tQuotesOrders(locale, 'reservationLabel')} ({percent}%)
            </span>
            <p className="quote-proposal-value">
              ${Number(depositAmount).toFixed(2)}
            </p>
          </div>
          <div className="quote-proposal-info-cell">
            <span className="quote-proposal-label">
              {tQuotesOrders(locale, 'docBalanceDueLine')}
            </span>
            <p className="quote-proposal-value">
              ${Number(balanceAmount).toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}
      <p className="quote-proposal-reservation-copy">
        {emphasizePercents(ruleHint?.trim() || paymentText)}
      </p>
      <p className="quote-proposal-reservation-split">
        {emphasizePercents(splitLine)}
      </p>
      {extraNotes}
    </section>
  )
}
