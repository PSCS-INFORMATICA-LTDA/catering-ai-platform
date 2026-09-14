import { tPayments } from '../i18n/payments.ts'

export type PaymentOgLocale = 'pt' | 'en' | 'es'

export const PAYMENT_OG_FALLBACK_IMAGE_PATH = '/api/public/company-brand/fallback/og'

const COMPANY_OG_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function paymentOgDescription(locale: string | null | undefined): string {
  return tPayments(locale, 'ogPaymentDescription')
}

export function isCompanyOgId(value: string | null | undefined): boolean {
  return COMPANY_OG_ID_RE.test(String(value || '').trim())
}

export function companyLogoStoragePath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null
  const marker = '/storage/v1/object/public/company-logos/'
  const index = logoUrl.indexOf(marker)
  if (index === -1) return null
  const path = decodeURIComponent(logoUrl.slice(index + marker.length).split('?')[0] || '')
  if (!path || path.includes('..') || path.startsWith('/')) return null
  return path
}

export function resolvePaymentOgOrigin(input: {
  forwardedHost?: string | null
  host?: string | null
  forwardedProto?: string | null
  vercelUrl?: string | null
  nextPublicAppUrl?: string | null
}): string {
  const host = String(input.forwardedHost || input.host || '').split(',')[0].trim()
  if (host && !/[\s<>]/.test(host)) {
    const inferred =
      host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https'
    const proto = String(input.forwardedProto || inferred).split(',')[0].trim()
    if (proto === 'http' || proto === 'https') {
      return `${proto}://${host}`.replace(/\/$/, '')
    }
  }
  const vercel = String(input.vercelUrl || '').trim().replace(/\/$/, '')
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`
  const configured = String(input.nextPublicAppUrl || '').trim().replace(/\/$/, '')
  if (configured) return configured
  return 'http://localhost:3000'
}

const PII_PATTERN =
  /@|telefone|phone|whatsapp|wa\.me|internal notes|observações internas|\+\s?\d[\d\s().-]{7,}|token=/i

export function paymentOgMetadataIsSafe(input: {
  title: string
  description: string
  imagePath: string
}): boolean {
  const blob = `${input.title}\n${input.description}\n${input.imagePath}`
  if (PII_PATTERN.test(blob)) return false
  if (/\/pay\/[A-Za-z0-9_-]{16,}/.test(input.imagePath)) return false
  if (/invoice_payment_links|token_hash/.test(blob)) return false
  return true
}
