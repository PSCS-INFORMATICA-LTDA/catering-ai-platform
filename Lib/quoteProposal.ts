/** Link público + mensagens de envio da cotação (padrão Logistics). */

import {
  buildClientQuoteWhatsAppText,
  buildQuoteProposalEmailSubjectLocalized,
} from '@/Lib/whatsappMessageTemplates'

const DEFAULT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
  'https://catering-ai-platform.vercel.app'

export function getPublicAppOrigin(): string {
  // No browser: prefer env (produção / Preview Vercel).
  if (typeof window === 'undefined') {
    return (
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      DEFAULT_PUBLIC_APP_URL
    )
  }

  const origin = window.location.origin.replace(/\/$/, '')
  // Localhost não deve ir para o cliente — usa URL pública configurada.
  if (/localhost|127\.0\.0\.1/i.test(origin)) {
    return (
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
      DEFAULT_PUBLIC_APP_URL
    )
  }
  // Preview / produção: link do próprio host (como o operador está testando).
  return origin
}

export function buildPublicProposalUrl(token: string, origin?: string): string {
  const base = (origin ?? getPublicAppOrigin()).replace(/\/$/, '')
  return `${base}/proposta/${token}`
}

export function resolveClientProposalShareUrl(
  token: string | null | undefined,
): string | null {
  if (!token?.trim()) return null
  return buildPublicProposalUrl(token.trim())
}

export type QuoteProposalShareInput = {
  quoteNumber: string
  customerName?: string | null
  eventDate?: string | null
  startTime?: string | null
  endTime?: string | null
  packageLabel?: string | null
  quoteTotal?: number | null
  reservationAmount?: number | null
  currencyCode?: string | null
  proposalUrl: string
  companyName?: string | null
  adultCount?: number | null
  childrenUnder3Count?: number | null
  children4To12Count?: number | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
  language?: string | null
  packageTotal?: number | null
  additionalTotal?: number | null
  packageHasGarnish?: boolean | null
  garnishIncludedTotal?: number | null
  garnishDescription?: string | null
  packageItemsDescription?: string | null
  packageUnitPrice?: number | null
  packageSelectionLines?: Array<{
    groupTitle: string
    itemLabel: string
  }> | null
  additionalLines?: Array<{
    label: string
    amount: number
    isGarnish?: boolean
  }> | null
  mileageFee?: number | null
  chargedMiles?: number | null
  mileageFreeLimit?: number | null
  grillRentalTotal?: number | null
  grillRentalQty?: number | null
  discountAmount?: number | null
  baseSubtotal?: number | null
  holidaySurchargeAmount?: number | null
  minimumOrderAdjustment?: number | null
  minimumOrderAmount?: number | null
  commercialReason?:
    | 'weekday'
    | 'weekend'
    | 'dec_jan'
    | 'cdl_holiday'
    | 'us_holiday'
    | 'none'
    | null
}

/** Texto WhatsApp / SMS — estilo Logistics (editável no painel). */
export function buildQuoteProposalShareText(input: QuoteProposalShareInput): string {
  return buildClientQuoteWhatsAppText(input)
}

export function buildQuoteProposalEmailSubject(input: QuoteProposalShareInput): string {
  return buildQuoteProposalEmailSubjectLocalized(input)
}

export function buildQuoteProposalEmailBody(input: QuoteProposalShareInput): string {
  return buildQuoteProposalShareText(input)
}

export function buildMailtoHref(params: {
  email?: string | null
  subject: string
  body: string
}): string | null {
  const email = params.email?.trim()
  const subject = encodeURIComponent(params.subject)
  const body = encodeURIComponent(params.body)
  if (email) return `mailto:${email}?subject=${subject}&body=${body}`
  return `mailto:?subject=${subject}&body=${body}`
}

export function newProposalToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
  }
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')
}
