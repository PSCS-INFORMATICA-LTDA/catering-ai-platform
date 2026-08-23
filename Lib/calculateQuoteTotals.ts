import {
  GRILL_RENTAL_FEE,
  MILEAGE_FREE_LIMIT,
  MILEAGE_RATE,
  RESERVATION_PERCENTAGE,
} from './cdlCommercialRules'
import {
  applyCommercialMinimums,
  type CommercialMinimumRules,
} from './quotes/applyCommercialMinimums'
import {
  calcBillableGuestCount,
  calcPhysicalGuestCount,
  type GuestCounts,
} from './quoteGuestFields'

export type { GuestCounts }

export type AdditionalLineInput = {
  quantity: number
  unitPrice: number
  perPerson: boolean
}

export type CalculateQuoteTotalsInput = {
  guestCounts: GuestCounts
  packagePricePerPerson: number
  additionals?: AdditionalLineInput[]
  additionalTotalOverride?: number | null
  mileageDistance?: number
  mileageFreeLimit?: number
  mileageRate?: number
  mileageFeeOverride?: number | null
  grillRentalRequired?: boolean
  grillRentalQty?: number
  grillRentalFeeOverride?: number | null
  reservationPercentage?: number
  reservationAmountOverride?: number | null
  useCustomReservation?: boolean
  /** Data do evento (YYYY-MM-DD) — necessária para mínimo/feriado. */
  eventDate?: string | null
  commercialMinimums?: CommercialMinimumRules | null
}

export type QuoteTotals = {
  billableAdults: number
  freeChildren: number
  halfPriceChildren: number
  /** adult_count + (children_4_to_12_count × 0.5) */
  billableGuestCount: number
  /** adult_count + children_under_3_count + children_4_to_12_count */
  physicalGuestCount: number
  packageTotal: number
  additionalTotal: number
  mileageFee: number
  /** Aluguel de churrasqueira (qty × taxa). */
  grillRentalTotal: number
  /** Pacote + adicionais + milhagem + churrasqueira (antes de regras comerciais). */
  quoteSubtotal: number
  holidaySurchargeAmount: number
  holidaySurchargePercent: number
  minimumOrderAmount: number
  minimumOrderApplied: boolean
  minimumOrderAdjustment: number
  reservationAmount: number
  balanceDue: number
  quoteTotal: number
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function toNumber(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0))
}

export function calcMileageFee(
  distance: number,
  freeLimit: number = MILEAGE_FREE_LIMIT,
  rate: number = MILEAGE_RATE,
) {
  const billableMiles = Math.max(0, toNumber(distance) - toNumber(freeLimit))
  return roundMoney(billableMiles * toNumber(rate))
}

export function calcGrillRentalFee(
  required: boolean,
  qty: number,
  feePerUnit: number = GRILL_RENTAL_FEE,
) {
  if (!required) return 0
  return roundMoney(Math.max(0, toNumber(qty)) * toNumber(feePerUnit))
}

export function calcAdditionalLineTotal(
  line: AdditionalLineInput,
  billableGuestCount: number,
) {
  const quantity = toNumber(line.quantity)
  if (quantity <= 0) return 0

  const unitPrice = toNumber(line.unitPrice)
  if (line.perPerson) {
    return roundMoney(unitPrice * billableGuestCount)
  }
  return roundMoney(unitPrice * quantity)
}

export function calculateQuoteTotals(
  input: CalculateQuoteTotalsInput,
): QuoteTotals {
  const guestCounts: GuestCounts = {
    adultCount: toNumber(input.guestCounts.adultCount),
    childrenUnder3Count: toNumber(input.guestCounts.childrenUnder3Count),
    children4To12Count: toNumber(input.guestCounts.children4To12Count),
  }

  const billableAdults = guestCounts.adultCount
  const freeChildren = guestCounts.childrenUnder3Count
  const halfPriceChildren = guestCounts.children4To12Count * 0.5
  const billableGuestCount = calcBillableGuestCount(guestCounts)
  const physicalGuestCount = calcPhysicalGuestCount(guestCounts)

  const packagePricePerPerson = toNumber(input.packagePricePerPerson)
  const packageTotal = roundMoney(packagePricePerPerson * billableGuestCount)

  const additionalTotal =
    input.additionalTotalOverride != null
      ? roundMoney(toNumber(input.additionalTotalOverride))
      : roundMoney(
          (input.additionals ?? []).reduce(
            (sum, line) =>
              sum + calcAdditionalLineTotal(line, billableGuestCount),
            0,
          ),
        )

  const mileageFee =
    input.mileageFeeOverride != null
      ? roundMoney(toNumber(input.mileageFeeOverride))
      : calcMileageFee(
          input.mileageDistance ?? 0,
          input.mileageFreeLimit ?? MILEAGE_FREE_LIMIT,
          input.mileageRate ?? MILEAGE_RATE,
        )

  const grillRentalTotal =
    input.grillRentalFeeOverride != null
      ? roundMoney(toNumber(input.grillRentalFeeOverride))
      : calcGrillRentalFee(
          Boolean(input.grillRentalRequired),
          input.grillRentalQty ?? 0,
        )

  const quoteSubtotal = roundMoney(
    packageTotal + additionalTotal + mileageFee + grillRentalTotal,
  )

  const commercial = input.commercialMinimums
    ? applyCommercialMinimums(
        quoteSubtotal,
        input.eventDate,
        input.commercialMinimums,
      )
    : {
        holidaySurchargeAmount: 0,
        holidaySurchargePercent: 0,
        minimumOrderAmount: 0,
        minimumOrderApplied: false,
        minimumOrderAdjustment: 0,
        quoteTotal: quoteSubtotal,
      }

  const quoteTotal = commercial.quoteTotal

  const reservationPercentage =
    input.reservationPercentage ?? RESERVATION_PERCENTAGE

  const reservationAmount = input.useCustomReservation
    ? roundMoney(toNumber(input.reservationAmountOverride))
    : roundMoney(quoteTotal * (reservationPercentage / 100))

  const balanceDue = roundMoney(quoteTotal - reservationAmount)

  return {
    billableAdults,
    freeChildren,
    halfPriceChildren,
    billableGuestCount,
    physicalGuestCount,
    packageTotal,
    additionalTotal,
    mileageFee,
    grillRentalTotal,
    quoteSubtotal,
    holidaySurchargeAmount: commercial.holidaySurchargeAmount,
    holidaySurchargePercent: commercial.holidaySurchargePercent,
    minimumOrderAmount: commercial.minimumOrderAmount,
    minimumOrderApplied: commercial.minimumOrderApplied,
    minimumOrderAdjustment: commercial.minimumOrderAdjustment,
    reservationAmount,
    balanceDue,
    quoteTotal,
  }
}

export {
  buildOfficialGuestPayload,
  calcBillableGuestCount,
  calcPhysicalGuestCount,
  readOfficialGuestCountsFromQuote,
} from './quoteGuestFields'
