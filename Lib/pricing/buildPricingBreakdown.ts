import { GRILL_RENTAL_FEE } from '@/Lib/cdlCommercialRules'
import { calcBillableMileageDistance } from '@/Lib/calculateQuoteTotals'
import { normalizeGrillRentalQty } from '@/Lib/grillRental'
import type { QuoteTotals } from '@/Lib/calculateQuoteTotals'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'
import { getPackageLabel } from '@/Lib/packageFieldAccess'
import type { QuoteAdditionalSaveLine } from '@/Lib/buildQuoteSavePayload'
import {
  PRICING_BREAKDOWN_SCHEMA_VERSION,
  PRICING_ENGINE_VERSION,
  type PricingBreakdown,
  type PricingBreakdownLine,
} from './pricingBreakdownTypes'
import type { ResolvedQuotePricingContext } from './resolveQuotePricingInput'

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export type BuildPricingBreakdownInput = {
  context: ResolvedQuotePricingContext
  totals: QuoteTotals
  resolvedAdditionals: QuoteAdditionalSaveLine[]
  rules: CommercialRulesSnapshot
  discountAmount?: number
  mileageDistance: number
  grillRentalRequired: boolean
  grillRentalQty: number
}

export function buildPricingBreakdown(
  input: BuildPricingBreakdownInput,
): PricingBreakdown {
  const {
    context,
    totals,
    resolvedAdditionals,
    rules,
    discountAmount = 0,
    mileageDistance,
    grillRentalRequired,
  } = input

  const pkg = context.package
  const packageLabel = getPackageLabel(pkg, context.language)
  const billableGuests = totals.billableGuestCount
  const packageUnitPrice = context.packagePricePerPerson
  const includedSidesTotal = Number(totals.includedSidesTotal ?? 0)
  const packageMeatAmount = roundMoney(
    Math.max(0, totals.packageTotal - includedSidesTotal),
  )
  const sidesUnit =
    billableGuests > 0 ? roundMoney(includedSidesTotal / billableGuests) : 0

  const lines: PricingBreakdownLine[] = [
    {
      line_key: 'package',
      source_type: 'package',
      source_id: pkg.id,
      description: packageLabel,
      quantity: billableGuests,
      unit: 'guest',
      unit_price:
        billableGuests > 0
          ? roundMoney(packageMeatAmount / billableGuests)
          : packageUnitPrice,
      amount: packageMeatAmount,
      formula: `${packageUnitPrice} × ${billableGuests}`,
      metadata: {
        package_key: pkg.package_key ?? null,
        physical_guest_count: totals.physicalGuestCount,
        package_list_price: packageUnitPrice,
      },
    },
  ]

  if (includedSidesTotal > 0) {
    lines.push({
      line_key: 'package_sides',
      source_type: 'package_sides',
      description: 'Plus guarnições',
      quantity: billableGuests,
      unit: 'guest',
      unit_price: sidesUnit,
      amount: includedSidesTotal,
      formula: `${sidesUnit} × ${billableGuests}`,
    })
  }

  for (const line of resolvedAdditionals) {
    const catalog = context.catalogById.get(line.itemId)
    lines.push({
      line_key: 'additional_item',
      source_type: 'catalog_item',
      source_id: line.itemId,
      description: catalog?.label_pt ?? catalog?.item_name ?? line.itemId,
      quantity: line.perPerson ? billableGuests : line.quantity,
      unit: line.perPerson ? 'guest' : catalog?.unit_label ?? 'unit',
      unit_price: line.unitPrice,
      amount: line.totalPrice,
      formula: line.perPerson
        ? `${line.unitPrice} × ${billableGuests}`
        : `${line.unitPrice} × ${line.quantity}`,
      metadata: {
        per_person: line.perPerson,
        selected_quantity: line.quantity,
      },
    })
  }

  if (totals.mileageFee > 0 || mileageDistance > 0) {
    const chargedMiles = calcBillableMileageDistance(
      mileageDistance,
      rules.mileageFreeLimit,
    )
    lines.push({
      line_key: 'mileage',
      source_type: 'mileage',
      description: `Milhagem (${rules.mileageBaseLocation})`,
      quantity: chargedMiles,
      unit: 'mi',
      unit_price: rules.mileageRate,
      amount: totals.mileageFee,
      formula:
        chargedMiles > 0
          ? `${mileageDistance} × ${rules.mileageRate}`
          : `0 (até ${rules.mileageFreeLimit} mi)`,
      metadata: {
        base_location: rules.mileageBaseLocation,
        distance: mileageDistance,
        free_limit: rules.mileageFreeLimit,
        full_trip: chargedMiles > 0,
      },
    })
  }

  if (totals.grillRentalTotal > 0) {
    const qty = normalizeGrillRentalQty(grillRentalRequired)
    lines.push({
      line_key: 'grill_rental',
      source_type: 'grill_rental',
      description: 'Aluguel de churrasqueira',
      quantity: qty,
      unit: 'unit',
      unit_price: GRILL_RENTAL_FEE,
      amount: totals.grillRentalTotal,
      formula: grillRentalRequired ? `${GRILL_RENTAL_FEE} × 1` : '0',
    })
  }

  const adjustments: PricingBreakdownLine[] = []

  if (totals.holidaySurchargeAmount > 0) {
    const packageOnlySurcharge = roundMoney(
      packageMeatAmount * (totals.holidaySurchargePercent / 100),
    )
    const packageOnly =
      Math.abs(packageOnlySurcharge - totals.holidaySurchargeAmount) < 0.009
    adjustments.push({
      line_key: 'holiday_surcharge',
      source_type: 'commercial_rule',
      rule_id: 'holiday_surcharge_percent',
      description: packageOnly
        ? `Acréscimo data especial (${totals.holidaySurchargePercent}% no pacote)`
        : `Acréscimo feriado (${totals.holidaySurchargePercent}%)`,
      quantity: 1,
      unit: 'adjustment',
      unit_price: totals.holidaySurchargeAmount,
      amount: totals.holidaySurchargeAmount,
      formula: packageOnly
        ? `${packageMeatAmount} × ${totals.holidaySurchargePercent}%`
        : `${totals.quoteSubtotal} × ${totals.holidaySurchargePercent}%`,
    })
  }

  if (totals.minimumOrderApplied && totals.minimumOrderAdjustment > 0) {
    adjustments.push({
      line_key: 'minimum_order',
      source_type: 'commercial_rule',
      rule_id: 'minimum_order',
      description: `Pedido mínimo (${totals.minimumOrderAmount})`,
      quantity: 1,
      unit: 'adjustment',
      unit_price: totals.minimumOrderAdjustment,
      amount: totals.minimumOrderAdjustment,
      formula: `max(0, ${totals.minimumOrderAmount} - subtotal_comercial)`,
      metadata: {
        minimum_order_amount: totals.minimumOrderAmount,
      },
    })
  }

  if (discountAmount > 0) {
    adjustments.push({
      line_key: 'discount',
      source_type: 'discount',
      description: 'Desconto',
      quantity: 1,
      unit: 'adjustment',
      unit_price: -discountAmount,
      amount: -discountAmount,
    })
  }

  const subtotal = roundMoney(totals.quoteSubtotal)
  const totalBeforeDiscount = totals.quoteTotal
  const total =
    discountAmount > 0
      ? roundMoney(Math.max(0, totalBeforeDiscount - discountAmount))
      : totalBeforeDiscount

  return {
    schema_version: PRICING_BREAKDOWN_SCHEMA_VERSION,
    lines,
    adjustments,
    subtotal,
    total,
    deposit: totals.reservationAmount,
    balance: discountAmount > 0
      ? roundMoney(total - totals.reservationAmount)
      : totals.balanceDue,
    rules_applied: rules,
    guest_counts: {
      adultCount: context.guestCounts.adultCount,
      childrenUnder3Count: context.guestCounts.childrenUnder3Count,
      children4To12Count: context.guestCounts.children4To12Count,
      billable_guest_count: totals.billableGuestCount,
      physical_guest_count: totals.physicalGuestCount,
    },
    computed_at: new Date().toISOString(),
    engine_version: PRICING_ENGINE_VERSION,
  }
}
