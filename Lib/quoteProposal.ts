/** Link público + mensagens de envio da cotação (padrão Logistics). */

import {
  resolveCanonicalAppUrl,
  getCanonicalAppUrl,
} from '@/Lib/canonicalAppUrl'
import {
  buildClientQuoteWhatsAppText,
  buildQuoteProposalEmailSubjectLocalized,
} from '@/Lib/whatsappMessageTemplates'

/**
 * Origem pública para links (proposta, WhatsApp, e-mail).
 * Prefere NEXT_PUBLIC_APP_URL canônico (HML: https://h.cateringai.app).
 * Fallback técnico (*.vercel.app) NÃO é URL oficial.
 */
export function getPublicAppOrigin(): string {
  const resolved = resolveCanonicalAppUrl()
  if (resolved.origin) return resolved.origin
  // Último recurso técnico interno — nunca tratar como canônico.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  throw new Error('CANONICAL ENVIRONMENTS: BLOCKED_DOMAIN_NOT_CONFIGURED')
}

export { getCanonicalAppUrl }

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
