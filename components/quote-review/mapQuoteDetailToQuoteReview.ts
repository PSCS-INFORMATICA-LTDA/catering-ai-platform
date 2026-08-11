import type {
  QuoteDetail,
  QuoteDetailPackageCatalogRow,
} from '@/app/quotes/[id]/quoteDetailTypes'
import { SIDES_PRICE_PER_PERSON } from '@/Lib/cdlCommercialRules'
import { resolvePackageCatalogImageUrl } from '@/Lib/packageCatalogVisual'
import type { QuoteSavedSnapshot } from '@/Lib/readQuoteSnapshot'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import {
  buildQuoteReviewPackageSummary,
  type QuoteReviewPackageFields,
  type QuoteReviewPackageSummary,
} from './quoteReviewPackageSummary'

function quoteLanguage(quote: QuoteDetail): QuoteLanguage {
  const lang = quote.language ?? 'pt'
  if (lang === 'en' || lang === 'es') return lang
  return 'pt'
}

function packageNameIndicatesGarnish(name: string | null | undefined): boolean {
  const normalized = (name ?? '').toLowerCase()
  return (
    normalized.includes('guarni') ||
    normalized.includes('guarnicion') ||
    normalized.includes('side dish')
  )
}

function linkedPackageFromQuote(
  quote: QuoteDetail,
): QuoteDetailPackageCatalogRow | null {
  const catalog = quote.packageCatalogPackages ?? []
  if (quote.package_id) {
    const match = catalog.find((row) => row.id === quote.package_id)
    if (match) return match
  }
  return catalog[0] ?? null
}

export function quoteDetailToPackageFields(
  quote: QuoteDetail,
): QuoteReviewPackageFields | null {
  const linked = linkedPackageFromQuote(quote)
  const packageKey = (quote.package_key ?? linked?.package_key)?.trim()
  if (!packageKey && !quote.package_name_pt && !linked?.package_name) return null

  return {
    package_key: packageKey,
    package_name: quote.package_name_pt ?? linked?.package_name ?? undefined,
    label_pt: quote.package_name_pt ?? linked?.label_pt ?? linked?.package_name,
    label_en: quote.package_name_en ?? linked?.label_en ?? undefined,
    label_es: quote.package_name_es ?? linked?.label_es ?? undefined,
    description_pt:
      quote.package_description_pt ??
      linked?.description_pt ??
      quote.package_description ??
      undefined,
    description_en:
      quote.package_description_en ?? linked?.description_en ?? undefined,
    description_es:
      quote.package_description_es ?? linked?.description_es ?? undefined,
    description: quote.package_description ?? undefined,
    price_per_person:
      quote.package_price_per_person ??
      quote.package_unit_price ??
      linked?.price_per_person ??
      undefined,
    price:
      quote.package_price_per_person ??
      quote.package_unit_price ??
      linked?.price_per_person ??
      undefined,
    image_url:
      linked?.image_url ??
      quote.package_image_url ??
      undefined,
  }
}

export function resolveQuoteDetailPackageImageUrl(quote: QuoteDetail): string | null {
  const catalogPackages = quote.packageCatalogPackages ?? []
  const pkg = quoteDetailToPackageFields(quote)

  return (
    resolvePackageCatalogImageUrl(pkg, catalogPackages, quote.package_id) ||
    quote.package_image_url?.trim() ||
    null
  )
}

export function buildQuoteReviewPackageSummaryFromQuote(
  quote: QuoteDetail,
  snapshot: Pick<QuoteSavedSnapshot, 'billableGuestCount'>,
  language?: QuoteLanguage | string | null,
): QuoteReviewPackageSummary | null {
  const pkg = quoteDetailToPackageFields(quote)
  if (!pkg) return null

  const displayLang: QuoteLanguage =
    language === 'en' || language === 'es' || language === 'pt'
      ? language
      : quoteLanguage(quote)

  const packageName =
    (displayLang === 'en'
      ? quote.package_name_en
      : displayLang === 'es'
        ? quote.package_name_es
        : quote.package_name_pt) ??
    quote.package_name_pt ??
    quote.package_name_en ??
    quote.package_name_es ??
    null

  return buildQuoteReviewPackageSummary({
    pkg,
    allPackages: quote.packageCatalogPackages ?? [],
    sidesPricePerPerson: SIDES_PRICE_PER_PERSON,
    chargedPeople: snapshot.billableGuestCount ?? 0,
    fromWithSidesSection:
      (quote.package_key ?? '').trim().endsWith('+') ||
      packageNameIndicatesGarnish(packageName),
    language: displayLang,
  })
}
