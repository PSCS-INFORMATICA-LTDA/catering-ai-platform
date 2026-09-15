import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import type { InvoiceKind, InvoiceSnapshot } from './types.ts'

export type InvoicePresentationRow = {
  id: string
  testId?: string
  kind:
    | 'package'
    | 'guest'
    | 'additional'
    | 'garnish'
    | 'mileage'
    | 'grill'
    | 'surcharge'
    | 'minimum'
    | 'discount'
    | 'subtotal'
    | 'total'
    | 'deposit'
    | 'balance'
    | 'paid'
    | 'outstanding'
    | 'info'
    | 'adjustment'
  labelKey: string
  labelText?: string | null
  quantity?: number | null
  unitPrice?: number | null
  amount: number | null
  formula?: string | null
  included?: boolean
  emphasize?: boolean
}

export type InvoiceCouponAllocationView = {
  code: string | null
  campaignName: string | null
  description: string | null
  discountType: string | null
  discountValue: number | null
  discountAmount: number
  applyToDeposit: boolean | null
  applyToBalance: boolean | null
  allocatedToDeposit: number | null
  allocatedToBalance: number | null
}

export type InvoiceFinancialPresentation = {
  currency: string
  invoiceKind: InvoiceKind
  packageName: string | null
  packageUnitPrice: number | null
  packageTotal: number | null
  guests: {
    adults: number
    children4To12: number
    childrenUnder3: number
    billableGuestCount: number
    physicalGuestCount: number
    adultAmount: number | null
    children4To12Amount: number | null
    childrenUnder3Amount: number
  }
  additionals: Array<{
    label: string
    quantity: number
    unitPrice: number
    total: number
    formula: string | null
  }>
  garnishes: {
    visible: boolean
    included: boolean
    description: string | null
    quantity: number | null
    unitPrice: number | null
    total: number
  }
  mileage: {
    visible: boolean
    distance: number | null
    freeLimit: number | null
    chargeable: number | null
    rate: number | null
    fee: number
    fullTrip: boolean
  }
  grill: {
    visible: boolean
    quantity: number
    unitPrice: number | null
    total: number
  }
  holidaySurcharge: number
  minimumAdjustment: number
  coupon: InvoiceCouponAllocationView | null
  baseBeforeDiscount: number
  finalContractTotal: number
  depositCalculationBase: number | null
  depositPercentage: number | null
  depositAmount: number
  balanceAmount: number
  paidTotal: number
  outstanding: number
  chargeRows: InvoicePresentationRow[]
  reconcileRows: InvoicePresentationRow[]
  reservationRows: InvoicePresentationRow[]
  paidRows: InvoicePresentationRow[]
  adjustmentRows: InvoicePresentationRow[]
  reconcilesToCent: boolean
  depositPlusBalanceMatchesTotal: boolean
}

function money(value: unknown) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function readNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? money(amount) : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function lineByKey(breakdown: PricingBreakdown | null | undefined, key: string) {
  return [...(breakdown?.lines ?? []), ...(breakdown?.adjustments ?? [])].find(
    (line) => line.line_key === key,
  )
}

function additionalLines(breakdown: PricingBreakdown | null | undefined) {
  return (breakdown?.lines ?? []).filter((line) => line.line_key === 'additional_item')
}

function couponRecord(snapshot: InvoiceSnapshot): Record<string, unknown> | null {
  const fromCommercial =
    snapshot.commercial.coupon && typeof snapshot.commercial.coupon === 'object'
      ? snapshot.commercial.coupon
      : null
  const fromBreakdown =
    snapshot.pricingBreakdown?.coupon && typeof snapshot.pricingBreakdown.coupon === 'object'
      ? (snapshot.pricingBreakdown.coupon as Record<string, unknown>)
      : null
  return fromCommercial || fromBreakdown
}

function boolOrNull(value: unknown): boolean | null {
  if (value === true || value === false) return value
  return null
}

export function buildInvoiceFinancialPresentation(input: {
  snapshot: InvoiceSnapshot
  invoiceKind?: InvoiceKind | string | null
  subtotal?: number | null
  total?: number | null
  depositAmount?: number | null
  balanceAmount?: number | null
  paidTotal?: number | null
  currency?: string | null
}): InvoiceFinancialPresentation {
  const snapshot = input.snapshot
  const breakdown = snapshot.pricingBreakdown
  const currency = (input.currency || snapshot.totals.currency || 'USD').toUpperCase()
  const invoiceKind = (input.invoiceKind === 'post_event_adjustment'
    ? 'post_event_adjustment'
    : 'original') as InvoiceKind

  const packageLine = lineByKey(breakdown, 'package')
  const sidesLine = lineByKey(breakdown, 'package_sides')
  const mileageLine = lineByKey(breakdown, 'mileage')
  const grillLine = lineByKey(breakdown, 'grill_rental')
  const holidayLine = lineByKey(breakdown, 'holiday_surcharge')
  const minimumLine = lineByKey(breakdown, 'minimum_order')
  const discountLine = lineByKey(breakdown, 'discount')

  const packageUnitPrice =
    readNumber(snapshot.package.unitPrice) ??
    readNumber(packageLine?.metadata?.package_list_price) ??
    readNumber(packageLine?.unit_price)
  const packageTotal =
    readNumber(packageLine?.amount) ?? readNumber(snapshot.package.total)
  const guests = snapshot.guests
  const adultAmount =
    packageUnitPrice != null ? money(guests.adults * packageUnitPrice) : null
  const children4To12Amount =
    packageUnitPrice != null
      ? money(guests.children4To12 * 0.5 * packageUnitPrice)
      : null

  const breakdownAdditionals = additionalLines(breakdown)
  const additionals =
    breakdownAdditionals.length > 0
      ? breakdownAdditionals.map((line) => ({
          label: line.description || 'Additional',
          quantity: Number(line.quantity || 0),
          unitPrice: money(line.unit_price),
          total: money(line.amount),
          formula: line.formula ?? null,
        }))
      : snapshot.additionals.map((line) => ({
          label: line.label,
          quantity: Number(line.quantity || 0),
          unitPrice: money(line.unitPrice),
          total: money(line.total),
          formula:
            line.quantity && line.unitPrice
              ? `${line.unitPrice} × ${line.quantity}`
              : null,
        }))

  const sidesAmount = money(sidesLine?.amount ?? snapshot.garnishes?.total ?? 0)
  const garnishes = {
    visible: Boolean(sidesLine || (snapshot.garnishes && (snapshot.garnishes.total > 0 || snapshot.garnishes.included || snapshot.garnishes.description))),
    included: sidesAmount <= 0 && Boolean(sidesLine || snapshot.garnishes?.description || snapshot.garnishes?.included),
    description: text(sidesLine?.description) || text(snapshot.garnishes?.description),
    quantity: sidesLine ? Number(sidesLine.quantity || 0) : null,
    unitPrice: sidesLine ? money(sidesLine.unit_price) : null,
    total: sidesAmount,
  }

  const mileageMeta = (mileageLine?.metadata || {}) as Record<string, unknown>
  const mileageFee = money(mileageLine?.amount ?? snapshot.mileage.fee ?? 0)
  const mileage = {
    visible:
      mileageFee > 0 ||
      Number(snapshot.mileage.distance || 0) > 0 ||
      Boolean(mileageLine),
    distance: readNumber(mileageMeta.distance) ?? readNumber(snapshot.mileage.distance),
    freeLimit: readNumber(mileageMeta.free_limit) ?? readNumber(snapshot.mileage.freeLimit),
    chargeable: readNumber(mileageLine?.quantity) ?? null,
    rate: readNumber(mileageLine?.unit_price) ?? readNumber(snapshot.mileage.rate),
    fee: mileageFee,
    fullTrip: mileageMeta.full_trip === true,
  }

  const grillTotal = money(grillLine?.amount ?? snapshot.grill.total)
  const grill = {
    visible: grillTotal > 0 || snapshot.grill.required,
    quantity: Number(grillLine?.quantity ?? snapshot.grill.quantity ?? 0),
    unitPrice: readNumber(grillLine?.unit_price),
    total: grillTotal,
  }

  const holidaySurcharge = money(
    holidayLine?.amount ?? snapshot.commercial.holidaySurcharge,
  )
  const minimumAdjustment = money(minimumLine?.amount ?? 0)
  const couponSource = couponRecord(snapshot)
  const discountAmount = money(
    Math.abs(Number(discountLine?.amount ?? snapshot.commercial.discount ?? 0)),
  )
  const coupon: InvoiceCouponAllocationView | null =
    couponSource || discountAmount > 0
      ? {
          code: text(couponSource?.code),
          campaignName: text(couponSource?.campaign_name),
          description: text(discountLine?.description),
          discountType: text(couponSource?.discount_type),
          discountValue: readNumber(couponSource?.discount_value),
          discountAmount,
          applyToDeposit: boolOrNull(couponSource?.apply_to_deposit),
          applyToBalance: boolOrNull(couponSource?.apply_to_balance),
          allocatedToDeposit: readNumber(couponSource?.deposit_discount_amount),
          allocatedToBalance: readNumber(couponSource?.balance_discount_amount),
        }
      : null

  const finalContractTotal = money(input.total ?? snapshot.totals.total)
  const baseBeforeDiscount = money(
    input.subtotal ??
      snapshot.totals.subtotal ??
      money(finalContractTotal + discountAmount),
  )
  const depositAmount = money(input.depositAmount ?? snapshot.reservation.depositAmount)
  const balanceAmount = money(input.balanceAmount ?? snapshot.reservation.balanceAmount)
  const depositPercentage = Number.isFinite(Number(snapshot.reservation.percentage))
    ? Number(snapshot.reservation.percentage)
    : readNumber(breakdown?.rules_applied?.reservationPercentage)
  const depositCalculationBase =
    depositPercentage && depositPercentage > 0
      ? money(depositAmount / (depositPercentage / 100))
      : baseBeforeDiscount
  const paidTotal = money(input.paidTotal ?? 0)
  const outstanding = money(Math.max(0, finalContractTotal - paidTotal))

  const chargeRows: InvoicePresentationRow[] = []
  if (packageTotal != null) {
    chargeRows.push({
      id: 'package-total',
      testId: 'invoice-package-total',
      kind: 'package',
      labelKey: 'packageLine',
      labelText: snapshot.package.name || snapshot.package.key,
      unitPrice: packageUnitPrice,
      amount: packageTotal,
      formula: packageLine?.formula ?? null,
    })
  }
  if (packageUnitPrice != null) {
    chargeRows.push({
      id: 'package-unit',
      testId: 'invoice-package-unit-price',
      kind: 'info',
      labelKey: 'packageUnitPrice',
      unitPrice: packageUnitPrice,
      amount: packageUnitPrice,
    })
  }
  chargeRows.push({
    id: 'adults',
    testId: 'invoice-adults',
    kind: 'guest',
    labelKey: 'adults',
    quantity: guests.adults,
    unitPrice: packageUnitPrice,
    amount: adultAmount,
    formula:
      packageUnitPrice != null ? `${guests.adults} × ${packageUnitPrice.toFixed(2)}` : null,
  })
  chargeRows.push({
    id: 'children-4-12',
    testId: 'invoice-children-4-12',
    kind: 'guest',
    labelKey: 'children4To12',
    quantity: guests.children4To12,
    unitPrice: packageUnitPrice,
    amount: children4To12Amount,
    formula:
      packageUnitPrice != null
        ? `${guests.children4To12} × 50% × ${packageUnitPrice.toFixed(2)}`
        : null,
  })
  chargeRows.push({
    id: 'children-0-3',
    testId: 'invoice-children-0-3',
    kind: 'guest',
    labelKey: 'childrenUnder3',
    quantity: guests.childrenUnder3,
    unitPrice: 0,
    amount: 0,
    formula: `${guests.childrenUnder3} × 0.00`,
  })
  chargeRows.push({
    id: 'billable-guests',
    testId: 'invoice-billable-guests',
    kind: 'info',
    labelKey: 'billableGuests',
    quantity: guests.billableGuestCount,
    amount: null,
  })
  chargeRows.push({
    id: 'physical-guests',
    testId: 'invoice-physical-guests',
    kind: 'info',
    labelKey: 'physicalGuests',
    quantity: guests.physicalGuestCount,
    amount: null,
  })
  if (garnishes.visible) {
    chargeRows.push({
      id: 'garnishes',
      testId: 'invoice-garnishes',
      kind: 'garnish',
      labelKey: garnishes.included ? 'garnishesIncluded' : 'garnishes',
      labelText: garnishes.description,
      quantity: garnishes.quantity,
      unitPrice: garnishes.unitPrice,
      amount: garnishes.included ? 0 : garnishes.total,
      included: garnishes.included,
      formula: sidesLine?.formula ?? null,
    })
  }
  additionals.forEach((line, index) => {
    chargeRows.push({
      id: `additional-${index}`,
      testId: `invoice-additional-${index}`,
      kind: 'additional',
      labelKey: 'additionals',
      labelText: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.total,
      formula: line.formula,
    })
  })
  if (mileage.visible) {
    chargeRows.push({
      id: 'mileage',
      testId: 'invoice-mileage',
      kind: 'mileage',
      labelKey: 'mileage',
      quantity: mileage.chargeable,
      unitPrice: mileage.rate,
      amount: mileage.fee,
      formula: mileageLine?.formula ?? null,
    })
  }
  if (grill.visible) {
    chargeRows.push({
      id: 'grill',
      testId: 'invoice-grill',
      kind: 'grill',
      labelKey: 'grill',
      quantity: grill.quantity,
      unitPrice: grill.unitPrice,
      amount: grill.total,
      formula: grillLine?.formula ?? null,
    })
  }
  if (holidaySurcharge > 0) {
    chargeRows.push({
      id: 'holiday',
      testId: 'invoice-holiday',
      kind: 'surcharge',
      labelKey: 'seasonalSurcharge',
      labelText: holidayLine?.description,
      amount: holidaySurcharge,
      formula: holidayLine?.formula ?? null,
    })
  }
  if (minimumAdjustment > 0) {
    chargeRows.push({
      id: 'minimum',
      testId: 'invoice-minimum',
      kind: 'minimum',
      labelKey: 'minimumAdjustment',
      labelText: minimumLine?.description,
      amount: minimumAdjustment,
      formula: minimumLine?.formula ?? null,
    })
  }
  if (discountAmount > 0) {
    chargeRows.push({
      id: 'discount',
      testId: 'invoice-discount',
      kind: 'discount',
      labelKey: 'discount',
      labelText: coupon?.code ? `${coupon.code}${coupon.campaignName ? ` · ${coupon.campaignName}` : ''}` : coupon?.description,
      amount: -discountAmount,
    })
  }

  const moneyLineKeys = new Set([
    'package',
    'additional',
    'garnish',
    'mileage',
    'grill',
    'surcharge',
    'minimum',
    'discount',
  ])
  const reconciledSum = money(
    chargeRows
      .filter((row) => moneyLineKeys.has(row.kind) && !(row.kind === 'garnish' && row.included))
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  )
  const reconcilesToCent = Math.abs(reconciledSum - finalContractTotal) <= 0.009
  const depositPlusBalanceMatchesTotal =
    Math.abs(money(depositAmount + balanceAmount) - finalContractTotal) <= 0.009

  const reconcileRows: InvoicePresentationRow[] = [
    {
      id: 'base-before-discount',
      testId: 'invoice-base-before-discount',
      kind: 'subtotal',
      labelKey: 'baseBeforeDiscount',
      amount: baseBeforeDiscount,
    },
    {
      id: 'final-contract-total',
      testId: 'invoice-final-contract-total',
      kind: 'total',
      labelKey: 'finalContractTotal',
      amount: finalContractTotal,
      emphasize: true,
    },
  ]

  const reservationRows: InvoicePresentationRow[] = [
    {
      id: 'deposit-base',
      testId: 'invoice-deposit-base',
      kind: 'info',
      labelKey: 'depositCalculationBase',
      amount: depositCalculationBase,
    },
    {
      id: 'deposit-percent',
      testId: 'invoice-deposit-percent',
      kind: 'info',
      labelKey: 'depositPercentage',
      quantity: depositPercentage,
      amount: null,
    },
    {
      id: 'deposit-amount',
      testId: 'invoice-deposit-amount',
      kind: 'deposit',
      labelKey: 'deposit',
      amount: depositAmount,
    },
  ]
  if (coupon && coupon.allocatedToDeposit != null) {
    reservationRows.push({
      id: 'discount-to-deposit',
      testId: 'invoice-discount-to-deposit',
      kind: 'discount',
      labelKey: 'discountAllocatedToDeposit',
      amount: coupon.allocatedToDeposit,
    })
  }
  if (coupon && coupon.allocatedToBalance != null) {
    reservationRows.push({
      id: 'discount-to-balance',
      testId: 'invoice-discount-to-balance',
      kind: 'discount',
      labelKey: 'discountAllocatedToBalance',
      amount: coupon.allocatedToBalance,
    })
  }
  reservationRows.push({
    id: 'contract-balance',
    testId: 'invoice-contract-balance',
    kind: 'balance',
    labelKey: 'originalBalance',
    amount: balanceAmount,
  })

  const paidRows: InvoicePresentationRow[] = [
    {
      id: 'paid-total',
      testId: 'invoice-paid-total',
      kind: 'paid',
      labelKey: 'paid',
      amount: paidTotal,
    },
    {
      id: 'outstanding',
      testId: 'invoice-outstanding',
      kind: 'outstanding',
      labelKey: 'invoiceOutstanding',
      amount: outstanding,
      emphasize: true,
    },
  ]

  const adjustment = snapshot.adjustment
  const adjustmentRows: InvoicePresentationRow[] = adjustment
    ? [
        {
          id: 'original-contract',
          testId: 'invoice-original-contract',
          kind: 'adjustment',
          labelKey: 'originalContract',
          amount: money(adjustment.originalInvoiceTotal),
        },
        {
          id: 'post-event-adjustment',
          testId: 'invoice-post-event-adjustment',
          kind: 'adjustment',
          labelKey: 'postEventAdjustment',
          amount: money(adjustment.finalEventTotal - adjustment.originalInvoiceTotal),
        },
        {
          id: 'final-event-cost',
          testId: 'invoice-final-event-cost',
          kind: 'adjustment',
          labelKey: 'finalEventCost',
          amount: money(adjustment.finalEventTotal),
          emphasize: true,
        },
      ]
    : []

  return {
    currency,
    invoiceKind,
    packageName: snapshot.package.name || snapshot.package.key,
    packageUnitPrice,
    packageTotal,
    guests: {
      adults: guests.adults,
      children4To12: guests.children4To12,
      childrenUnder3: guests.childrenUnder3,
      billableGuestCount: guests.billableGuestCount,
      physicalGuestCount: guests.physicalGuestCount,
      adultAmount,
      children4To12Amount,
      childrenUnder3Amount: 0,
    },
    additionals,
    garnishes,
    mileage,
    grill,
    holidaySurcharge,
    minimumAdjustment,
    coupon,
    baseBeforeDiscount,
    finalContractTotal,
    depositCalculationBase,
    depositPercentage,
    depositAmount,
    balanceAmount,
    paidTotal,
    outstanding,
    chargeRows,
    reconcileRows,
    reservationRows,
    paidRows,
    adjustmentRows,
    reconcilesToCent,
    depositPlusBalanceMatchesTotal,
  }
}

export function explainDepositFromCanonical(presentation: InvoiceFinancialPresentation) {
  const percent = Number(presentation.depositPercentage || 0)
  const expected =
    percent > 0 ? money(presentation.baseBeforeDiscount * (percent / 100)) : null
  return {
    baseBeforeDiscount: presentation.baseBeforeDiscount,
    depositPercentage: percent,
    expectedDepositFromBase: expected,
    actualDeposit: presentation.depositAmount,
    matchesBaseTimesPercent:
      expected != null && Math.abs(expected - presentation.depositAmount) <= 0.009,
    applyToDeposit: presentation.coupon?.applyToDeposit ?? null,
    applyToBalance: presentation.coupon?.applyToBalance ?? null,
    allocatedToDeposit: presentation.coupon?.allocatedToDeposit ?? null,
    allocatedToBalance: presentation.coupon?.allocatedToBalance ?? null,
  }
}

export function presentationHasMergedChildren(presentation: InvoiceFinancialPresentation) {
  return (
    !presentation.chargeRows.some((row) => row.id === 'children-4-12') ||
    !presentation.chargeRows.some((row) => row.id === 'children-0-3')
  )
}
