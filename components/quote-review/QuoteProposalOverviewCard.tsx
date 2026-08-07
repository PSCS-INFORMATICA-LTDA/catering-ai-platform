'use client'

import type { ReactNode } from 'react'
import { formatMoneyOrDash } from '@/Lib/readQuoteSnapshot'
import { formatDate } from '@/app/quotes/[id]/quoteDetailTypes'
import type { QuoteReviewPackageSummary } from './quoteReviewPackageSummary'

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
}): QuoteFinancialLine[] {
  const lines: QuoteFinancialLine[] = []
  const summary = input.packageSummary

  if (summary?.hasGarnish) {
    if ((summary.packageTotalPrice ?? 0) > 0) {
      lines.push({
        label: 'Pacote',
        value: formatMoneyOrDash(summary.packageTotalPrice),
      })
    }
    if ((summary.garnishTotalPrice ?? 0) > 0) {
      lines.push({
        label: 'Guarnições',
        value: formatMoneyOrDash(summary.garnishTotalPrice),
      })
    }
  } else if ((input.packageTotal ?? 0) > 0) {
    lines.push({
      label: 'Pacote',
      value: formatMoneyOrDash(input.packageTotal),
    })
  }

  if ((input.additionalTotal ?? 0) > 0) {
    lines.push({
      label: 'Extras na cotação',
      value: formatMoneyOrDash(input.additionalTotal),
    })
  }

  if ((input.mileageFee ?? 0) > 0) {
    const charged = Number(input.chargedMiles ?? 0)
    const free = Number(input.mileageFreeLimit ?? 20)
    lines.push({
      label:
        charged > 0
          ? `Milhagem (${charged} mi cobradas além de ${free} mi cortesia)`
          : 'Milhagem',
      value: formatMoneyOrDash(input.mileageFee),
    })
  }

  if ((input.grillRentalTotal ?? 0) > 0) {
    lines.push({
      label: 'Aluguel de churrasqueira',
      value: formatMoneyOrDash(input.grillRentalTotal),
    })
  }

  if ((input.holidaySurchargeAmount ?? 0) > 0) {
    lines.push({
      label: 'Adicional de feriado / data comemorativa (100%)',
      value: formatMoneyOrDash(input.holidaySurchargeAmount),
    })
  }

  if ((input.minimumOrderAdjustment ?? 0) > 0.009) {
    lines.push({
      label: 'Ajuste para pedido mínimo',
      value: formatMoneyOrDash(input.minimumOrderAdjustment),
    })
  }

  if ((input.discountAmount ?? 0) > 0) {
    lines.push({
      label: 'Desconto',
      value: formatMoneyOrDash(input.discountAmount),
      discount: true,
    })
  }

  lines.push({
    label: 'Total',
    value: formatMoneyOrDash(input.quoteTotal),
    emphasis: true,
  })

  if ((input.reservationAmount ?? 0) > 0) {
    lines.push({
      label: 'Reserva (sinal)',
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
  /** Conteúdo logo após o nome do cliente (ex.: regras comerciais). */
  afterClient?: ReactNode
}) {
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
  })

  return (
    <div className="quote-proposal-overview quote-proposal-overview--enhanced">
      <div className="quote-proposal-overview-top">
        <div className="quote-proposal-overview-item">
          <span className="quote-proposal-label">Cliente</span>
          <p className="quote-proposal-value">{customerName || '—'}</p>
        </div>
        <div className="quote-proposal-overview-item">
          <span className="quote-proposal-label">Evento</span>
          <p className="quote-proposal-value">{formatDate(eventDate)}</p>
        </div>
      </div>

      {afterClient ? (
        <div className="quote-proposal-overview-after-client mt-5 space-y-4">
          {afterClient}
        </div>
      ) : null}

      <div className="quote-proposal-overview-location">
        <span className="quote-proposal-label">Local</span>
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
            <span className="quote-proposal-overview-badge">Com guarnições</span>
          ) : null}
          {additionalsCount > 0 ? (
            <span className="quote-proposal-overview-badge">
              {additionalsCount} adicional{additionalsCount !== 1 ? 'is' : ''}
            </span>
          ) : null}
          {grillRentalRequired ? (
            <span className="quote-proposal-overview-badge">
              Churrasqueira para alugar
            </span>
          ) : null}
        </div>
      )}

      <div className="quote-proposal-overview-finance">
        <p className="quote-proposal-label">Resumo financeiro</p>
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
    </div>
  )
}
