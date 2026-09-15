import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export function resolveInvoiceDocumentLocale(
  value: string | null | undefined,
): QuoteLanguage {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (normalized === 'es' || normalized.startsWith('es-') || normalized.startsWith('spa')) {
    return 'es'
  }
  return 'pt'
}

export function resolvePublicPaymentLocale(input: {
  invoiceLocale?: string | null
  previewLang?: string | null
}): QuoteLanguage {
  const preview = String(input.previewLang || '').trim().toLowerCase()
  if (preview === 'en' || preview === 'es' || preview === 'pt') return preview
  return resolveInvoiceDocumentLocale(input.invoiceLocale)
}
