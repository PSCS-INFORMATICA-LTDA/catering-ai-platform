import {
  getAdditionalCategory,
  getAdditionalImage,
  getAdditionalLabel,
  getPackageName,
  getZipCode,
  type QuoteDetail,
  type QuoteDetailPackageCatalogRow,
} from '@/app/quotes/[id]/quoteDetailTypes'
import { SIDES_PRICE_PER_PERSON } from '@/Lib/cdlCommercialRules'
import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import {
  deriveGrillPhotoStatus,
  getGrillPhotoStatusLabel,
} from '@/Lib/grillPhotoStatus'
import { resolvePackageCatalogImageUrl } from '@/Lib/packageCatalogVisual'
import {
  PRICING_BREAKDOWN_SCHEMA_VERSION,
  type PricingBreakdown,
  type PricingBreakdownLine,
} from '@/Lib/pricing/pricingBreakdownTypes'
import {
  getChargedMilesFromSnapshot,
  readPricingBreakdown,
  readQuoteSnapshot,
  type QuoteSavedSnapshot,
} from '@/Lib/readQuoteSnapshot'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { getFallbackCommercialRules } from '@/Lib/supabaseCommercialRules'
import {
  buildQuoteReviewPackageSummary,
  type QuoteReviewPackageFields,
  type QuoteReviewPackageSummary,
} from './quoteReviewPackageSummary'
import type { QuoteReviewAdditional, QuoteReviewData } from './quoteReviewTypes'

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

function firstBreakdownLine(
  breakdown: PricingBreakdown,
  lineKey: string,
): PricingBreakdownLine | null {
  return (
    [...breakdown.lines, ...breakdown.adjustments].find(
      (line) => line.line_key === lineKey,
    ) ?? null
  )
}

function breakdownLineTotal(
  breakdown: PricingBreakdown,
  lineKey: string,
): number {
  return [...breakdown.lines, ...breakdown.adjustments]
    .filter((line) => line.line_key === lineKey)
    .reduce((total, line) => total + Number(line.amount ?? 0), 0)
}

function asDisplayLanguage(
  language: QuoteLanguage | string | null | undefined,
  quote: QuoteDetail,
): QuoteLanguage {
  if (language === 'en' || language === 'es' || language === 'pt') return language
  return quoteLanguage(quote)
}

function presentationMileageLine(
  quote: QuoteDetail,
  snapshot: QuoteSavedSnapshot,
  fallback: PricingBreakdown['rules_applied'],
): PricingBreakdownLine {
  const distance = Number(snapshot.mileageDistance ?? quote.mileage_distance ?? 0)
  const freeLimit = Number(
    snapshot.mileageFreeLimit ??
      quote.mileage_free_limit ??
      fallback.mileageFreeLimit,
  )
  const rate = Number(
    snapshot.mileageRate ?? quote.mileage_rate ?? fallback.mileageRate,
  )
  const fee = Number(snapshot.mileageFee ?? quote.mileage_fee ?? 0)
  const charged = getChargedMilesFromSnapshot(distance, freeLimit) ?? 0
  const baseLocation =
    snapshot.mileageBaseLocation ??
    quote.mileage_base_location ??
    fallback.mileageBaseLocation

  return {
    line_key: 'mileage',
    source_type: 'mileage',
    description: `Milhagem (${baseLocation})`,
    quantity: charged,
    unit: 'mi',
    unit_price: rate,
    amount: fee,
    formula: `max(0, ${distance} - ${freeLimit}) × ${rate}`,
    metadata: {
      base_location: baseLocation,
      distance,
      free_limit: freeLimit,
    },
  }
}

function ensurePresentationLines(
  breakdown: PricingBreakdown,
  quote: QuoteDetail,
  snapshot: QuoteSavedSnapshot,
): PricingBreakdown {
  const lines = [...breakdown.lines]
  const adjustments = [...breakdown.adjustments]
  const mileageIndex = lines.findIndex((line) => line.line_key === 'mileage')

  const hasMileageValues =
    Number(snapshot.mileageDistance ?? quote.mileage_distance ?? 0) > 0 ||
    Number(snapshot.mileageFee ?? quote.mileage_fee ?? 0) > 0

  if (mileageIndex < 0 && hasMileageValues) {
    lines.push(
      presentationMileageLine(quote, snapshot, breakdown.rules_applied),
    )
  } else if (mileageIndex >= 0) {
    const current = lines[mileageIndex]
    const fallback = presentationMileageLine(
      quote,
      snapshot,
      breakdown.rules_applied,
    )
    lines[mileageIndex] = {
      ...current,
      metadata: {
        ...fallback.metadata,
        ...current.metadata,
      },
      formula: current.formula ?? fallback.formula,
    }
  }

  if (
    !lines.some((line) => line.line_key === 'grill_rental') &&
    Number(quote.grill_rental_total ?? 0) > 0
  ) {
    const qty = Number(quote.grill_rental_qty ?? 1)
    const amount = Number(quote.grill_rental_total ?? 0)
    lines.push({
      line_key: 'grill_rental',
      source_type: 'grill_rental',
      description: 'Aluguel de churrasqueira',
      quantity: qty,
      unit: 'unit',
      unit_price: qty > 0 ? amount / qty : amount,
      amount,
    })
  }

  return {
    ...breakdown,
    lines,
    adjustments,
  }
}

function reconstructPresentationBreakdown(
  quote: QuoteDetail,
  snapshot: QuoteSavedSnapshot,
): PricingBreakdown {
  const rules = getFallbackCommercialRules()
  const lines: PricingBreakdownLine[] = []
  const adjustments: PricingBreakdownLine[] = []
  const packageAmount = Number(snapshot.packageTotal ?? 0)
  const packageUnit = Number(snapshot.packageUnitPrice ?? 0)
  const billable = Number(snapshot.billableGuestCount ?? 0)

  lines.push({
    line_key: 'package',
    source_type: 'package',
    source_id: quote.package_id ?? null,
    description: quote.package_name_pt ?? quote.package_key ?? 'Package',
    quantity: billable,
    unit: 'guest',
    unit_price: packageUnit,
    amount: packageAmount,
    formula: `${packageUnit} × ${billable}`,
  })

  for (const item of quote.additional_items ?? []) {
    const quantity = Number(item.quantity ?? 0)
    const unitPrice = Number(item.unit_price ?? 0)
    const amount = Number(item.total_price ?? 0)
    lines.push({
      line_key: 'additional_item',
      source_type: 'catalog_item',
      source_id: item.item_id,
      description: item.label_pt ?? item.item_key ?? item.item_id,
      quantity,
      unit: 'unit',
      unit_price: unitPrice,
      amount,
      formula: `${unitPrice} × ${quantity}`,
    })
  }

  if (
    Number(snapshot.mileageDistance ?? 0) > 0 ||
    Number(snapshot.mileageFee ?? 0) > 0
  ) {
    lines.push(presentationMileageLine(quote, snapshot, rules))
  }

  const grillAmount = Number(quote.grill_rental_total ?? 0)
  if (grillAmount > 0) {
    const qty = Number(quote.grill_rental_qty ?? 1)
    lines.push({
      line_key: 'grill_rental',
      source_type: 'grill_rental',
      description: 'Aluguel de churrasqueira',
      quantity: qty,
      unit: 'unit',
      unit_price: qty > 0 ? grillAmount / qty : grillAmount,
      amount: grillAmount,
    })
  }

  const holiday = Number(quote.holiday_surcharge_amount ?? 0)
  if (holiday > 0) {
    adjustments.push({
      line_key: 'holiday_surcharge',
      source_type: 'commercial_rule',
      description: 'Acréscimo feriado',
      quantity: 1,
      unit: 'adjustment',
      unit_price: holiday,
      amount: holiday,
    })
  }

  const discount = Number(quote.discount_amount ?? quote.discount ?? 0)
  if (discount > 0) {
    adjustments.push({
      line_key: 'discount',
      source_type: 'discount',
      description: 'Desconto',
      quantity: 1,
      unit: 'adjustment',
      unit_price: discount,
      amount: -discount,
    })
  }

  return {
    schema_version: PRICING_BREAKDOWN_SCHEMA_VERSION,
    lines,
    adjustments,
    subtotal: lines.reduce((total, line) => total + Number(line.amount ?? 0), 0),
    total: Number(snapshot.quoteTotal ?? 0),
    deposit: Number(snapshot.reservationAmount ?? 0),
    balance: Number(snapshot.balanceDue ?? 0),
    rules_applied: {
      ...rules,
      mileageBaseLocation:
        snapshot.mileageBaseLocation ?? rules.mileageBaseLocation,
      mileageFreeLimit: snapshot.mileageFreeLimit ?? rules.mileageFreeLimit,
      mileageRate: snapshot.mileageRate ?? rules.mileageRate,
      reservationPercentage:
        snapshot.reservationPercentage ?? rules.reservationPercentage,
      source: 'fallback',
    },
    guest_counts: {
      adultCount: snapshot.guestCounts.adultCount,
      childrenUnder3Count: snapshot.guestCounts.childrenUnder3Count,
      children4To12Count: snapshot.guestCounts.children4To12Count,
      billable_guest_count: Number(snapshot.billableGuestCount ?? 0),
      physical_guest_count: Number(snapshot.physicalGuestCount ?? 0),
    },
    computed_at: quote.created_at ?? new Date(0).toISOString(),
    engine_version: 'snapshot-presentation',
  }
}

/**
 * Apresentação da cotação salva. Prefere pricing_breakdown persistido.
 * Sem breakdown, apenas envelopa colunas já gravadas — sem recalcular regras.
 */
export function buildSavedQuotePresentationBreakdown(
  quote: QuoteDetail,
): PricingBreakdown {
  const snapshot = readQuoteSnapshot(quote)
  const persisted = readPricingBreakdown(quote)
  if (persisted) {
    return ensurePresentationLines(persisted, quote, snapshot)
  }
  return reconstructPresentationBreakdown(quote, snapshot)
}

export function mapQuoteDetailToQuoteReview(
  quote: QuoteDetail,
  language?: QuoteLanguage | string | null,
): QuoteReviewData {
  const lang = asDisplayLanguage(language, quote)
  const snapshot = readQuoteSnapshot(quote)
  const breakdown = buildSavedQuotePresentationBreakdown(quote)
  const packageLine = firstBreakdownLine(breakdown, 'package')
  const mileageLine = firstBreakdownLine(breakdown, 'mileage')
  const grillRentalLine = firstBreakdownLine(breakdown, 'grill_rental')
  const holidayLine = firstBreakdownLine(breakdown, 'holiday_surcharge')
  const minimumLine = firstBreakdownLine(breakdown, 'minimum_order')
  const discountLine = firstBreakdownLine(breakdown, 'discount')
  const customerName = getCustomerDisplayNameFromQuote(quote)
  const additionals: QuoteReviewAdditional[] = (quote.additional_items ?? []).map(
    (item) => ({
      id: item.item_id,
      label: getAdditionalLabel(item, lang),
      category: getAdditionalCategory(item, lang),
      quantity: item.quantity ?? null,
      unitPrice: item.unit_price ?? null,
      totalPrice: item.total_price ?? null,
      imageUrl: getAdditionalImage(item),
      itemType: item.item_type,
      categoryPt: item.category_pt,
    }),
  )

  return {
    preview: false,
    quoteNumber: quote.quote_number ?? undefined,
    quoteStatus: quote.quote_status,
    language: lang,
    customerName,
    eventName: quote.event_name?.trim() || customerName,
    eventDate: quote.event_date ?? null,
    startTime: quote.start_time ?? null,
    endTime: quote.end_time ?? null,
    addressLine: quote.address_line ?? null,
    city: quote.city ?? null,
    state: quote.state ?? null,
    zipCode: getZipCode(quote),
    packageName: getPackageName(quote, lang) ?? null,
    packageImageUrl: resolveQuoteDetailPackageImageUrl(quote),
    packageUnitPrice: packageLine?.unit_price ?? snapshot.packageUnitPrice,
    packageTotal: packageLine?.amount ?? snapshot.packageTotal,
    packageSummary: buildQuoteReviewPackageSummaryFromQuote(
      quote,
      snapshot,
      lang,
    ),
    packageSelections: quote.package_selection_labels ?? [],
    guestCounts: snapshot.guestCounts,
    billableGuestCount: breakdown.guest_counts.billable_guest_count,
    physicalGuestCount: breakdown.guest_counts.physical_guest_count,
    hasGrill: quote.has_grill ?? null,
    grillPhotoRequired: quote.grill_photo_required ?? null,
    grillPhotoStatusLabel: quote.has_grill
      ? getGrillPhotoStatusLabel(
          deriveGrillPhotoStatus({
            hasGrill: quote.has_grill,
            grillPhotoRequired: quote.grill_photo_required,
            grillPhotoUrl: quote.grill_photo_url,
            grillPhotoMediaId: quote.grill_photo_media_id,
          }),
          lang,
        )
      : undefined,
    grillPhotoUrl: quote.grill_photo_url ?? null,
    grillRentalRequired: quote.grill_rental_required ?? null,
    grillRentalQty:
      grillRentalLine?.quantity ??
      (quote.grill_rental_required ? quote.grill_rental_qty ?? null : null),
    grillRentalTotal: grillRentalLine?.amount ?? quote.grill_rental_total ?? null,
    grillNotes: quote.grill_notes ?? null,
    mileageBaseLocation:
      String(
        mileageLine?.metadata?.base_location ??
          snapshot.mileageBaseLocation ??
          breakdown.rules_applied.mileageBaseLocation,
      ) || null,
    mileageDistance:
      mileageLine?.metadata?.distance != null
        ? Number(mileageLine.metadata.distance)
        : snapshot.mileageDistance,
    mileageFreeLimit:
      mileageLine?.metadata?.free_limit != null
        ? Number(mileageLine.metadata.free_limit)
        : snapshot.mileageFreeLimit,
    mileageRate: mileageLine?.unit_price ?? snapshot.mileageRate,
    mileageFee: mileageLine?.amount ?? snapshot.mileageFee,
    additionalTotal: breakdown.lines.some(
      (line) => line.line_key === 'additional_item',
    )
      ? breakdownLineTotal(breakdown, 'additional_item')
      : snapshot.additionalTotal,
    holidaySurchargeAmount:
      holidayLine?.amount ?? quote.holiday_surcharge_amount ?? null,
    minimumOrderAdjustment: minimumLine?.amount ?? null,
    minimumOrderApplied:
      Boolean(minimumLine) || Boolean(quote.minimum_order_applied),
    minimumOrderAmount: Number(
      minimumLine?.metadata?.minimum_order_amount ??
        quote.minimum_order_amount ??
        0,
    ) || null,
    reservationPercentage:
      breakdown.rules_applied.reservationPercentage ??
      snapshot.reservationPercentage,
    reservationAmount: breakdown.deposit,
    balanceDue: breakdown.balance,
    quoteTotal: breakdown.total,
    discount: Math.abs(
      Number(
        discountLine?.amount ?? quote.discount_amount ?? quote.discount ?? 0,
      ),
    ),
    additionals,
  }
}
