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
}: {
  language?: string | null
  extraNotes?: ReactNode
}) {
  const locale = loc(language)
  const paymentText = tQuotesOrders(locale, 'docReservationPaymentText')
  const splitLine = `${tQuotesOrders(locale, 'reservationLabel')}: ${RESERVATION_PERCENTAGE}% · ${tQuotesOrders(locale, 'docBalanceDueLine')}: ${BALANCE_PERCENTAGE}%`

  return (
    <section className="quote-proposal-section quote-proposal-reservation-card quote-print-section quote-proposal-section--compact">
      <h2 className="quote-proposal-section-title">
        {tQuotesOrders(locale, 'reservationLabel')}
      </h2>
      <p className="quote-proposal-reservation-copy">
        {emphasizePercents(paymentText)}
      </p>
      <p className="quote-proposal-reservation-split">
        {emphasizePercents(splitLine)}
      </p>
      {extraNotes}
    </section>
  )
}
