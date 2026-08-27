import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import { isPricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import {
  getAdditionalLabel,
  type QuoteDetail,
} from '@/app/quotes/[id]/quoteDetailTypes'
import {
  INVOICE_SNAPSHOT_VERSION,
  type InvoiceSnapshot,
} from './types'

function money(value: unknown): number {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100
}

function localeOf(value: string | null | undefined): QuoteLanguage {
  return value === 'en' || value === 'es' ? value : 'pt'
}

function formatAddress(quote: QuoteDetail): string | null {
  const parts = [
    quote.address_line,
    quote.city,
    quote.state,
    quote.zip_code || quote.postal_code,
  ]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function buildInvoiceSnapshot(quote: QuoteDetail): InvoiceSnapshot {
  const locale = localeOf(quote.language)
  const breakdown = isPricingBreakdown(quote.pricing_breakdown)
    ? quote.pricing_breakdown
    : null
  const total = money(quote.quote_total ?? breakdown?.total)
  const deposit = money(quote.reservation_amount ?? breakdown?.deposit)
  const balance = money(
    quote.balance_due ?? breakdown?.balance ?? Math.max(0, total - deposit),
  )
  const packageTotal = money(quote.package_total)
  const additionalTotal = money(quote.additional_total)
  const mileageFee = money(quote.mileage_fee)
  const grillTotal = money(quote.grill_rental_total)
  const discount = money(quote.discount ?? quote.discount_amount)
  const holiday = money(quote.holiday_surcharge_amount)
  const subtotal = money(
    breakdown?.subtotal ??
      packageTotal + additionalTotal + mileageFee + grillTotal,
  )

  return {
    version: INVOICE_SNAPSHOT_VERSION,
    frozenAt: new Date().toISOString(),
    locale,
    quote: {
      id: quote.id,
      number: quote.quote_number ?? null,
      status: quote.quote_status ?? null,
    },
    customer: {
      id: quote.customer_id ?? null,
      name: getCustomerDisplayNameFromQuote(quote),
      email: quote.email ?? null,
      phone: quote.phone ?? null,
    },
    event: {
      name: quote.event_name ?? null,
      date: quote.event_date ?? null,
      startTime: quote.start_time ?? null,
      endTime: quote.end_time ?? null,
      address: formatAddress(quote),
      city: quote.city ?? null,
      region: quote.state ?? null,
      postalCode: quote.zip_code ?? quote.postal_code ?? null,
    },
    package: {
      id: quote.package_id ?? null,
      key: quote.package_key ?? null,
      name:
        locale === 'en'
          ? quote.package_name_en || quote.package_name_pt || null
          : locale === 'es'
            ? quote.package_name_es || quote.package_name_pt || null
            : quote.package_name_pt || quote.package_name_en || null,
      unitPrice: money(quote.package_unit_price ?? quote.package_price_per_person),
      total: packageTotal,
    },
    guests: {
      adults: Number(quote.adult_count ?? 0),
      childrenUnder3: Number(quote.children_under_3_count ?? 0),
      children4To12: Number(quote.children_4_to_12_count ?? 0),
      billableGuestCount: Number(quote.billable_guest_count ?? 0),
      physicalGuestCount: Number(quote.physical_guest_count ?? 0),
    },
    additionals: (quote.additional_items ?? []).map((item) => ({
      itemId: item.item_id,
      label: getAdditionalLabel(item, locale) || item.item_key || item.item_id,
      quantity: Number(item.quantity ?? 0),
      unitPrice: money(item.unit_price),
      total: money(item.total_price),
    })),
    garnishes: (() => {
      const sides = breakdown?.lines.find((line) => line.line_key === 'package_sides')
      return {
        included: Boolean(sides && Number(sides.amount) > 0),
        description: sides?.description ?? null,
        total: money(sides?.amount),
      }
    })(),
    grill: {
      required: Boolean(quote.grill_rental_required),
      quantity: quote.grill_rental_required ? 1 : 0,
      total: grillTotal,
    },
    mileage: {
      distance: quote.mileage_distance ?? null,
      freeLimit: quote.mileage_free_limit ?? null,
      rate: quote.mileage_rate ?? null,
      fee: mileageFee,
    },
    commercial: {
      discount,
      holidaySurcharge: holiday,
      minimumOrderAmount: money(quote.minimum_order_amount),
      minimumOrderApplied: Boolean(quote.minimum_order_applied),
      onlinePaymentFee: 0,
    },
    reservation: {
      percentage: Number(quote.reservation_percentage ?? 30),
      depositAmount: deposit,
      balanceAmount: balance,
    },
    totals: {
      subtotal,
      total,
      currency: quote.currency_code || 'USD',
    },
    pricingBreakdown: breakdown,
  }
}
