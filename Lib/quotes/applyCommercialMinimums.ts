import {
  isCdlHolidayDate,
  matchHolidaySurchargeDate,
  parseEventDateParts,
  type HolidayDateParts,
} from '../usHolidays'

export type CommercialMinimumRules = {
  minOrderWeekday: number
  minOrderWeekend: number
  minOrderDecJan: number
  holidaySurchargePercent: number
  holidayMinOrder: number
}

export type EventDateParts = HolidayDateParts

export type CommercialAdjustmentOptions = {
  /**
   * Package meat component only. Special CDL dates apply +100% to this base,
   * never to sides, extras, mileage, grill or waiter.
   */
  packageSurchargeBase?: number
}

export type CommercialAdjustmentResult = {
  isHolidaySurchargeDate: boolean
  isSpecialCdlDate: boolean
  /** @deprecated use isHolidaySurchargeDate */
  isCdlHoliday: boolean
  holidayKey: string | null
  holidayLabel: string | null
  isDecemberOrJanuary: boolean
  isWeekend: boolean
  holidaySurchargePercent: number
  holidaySurchargeAmount: number
  commercialAfterSurcharge: number
  minimumOrderAmount: number
  minimumOrderApplied: boolean
  minimumOrderAdjustment: number
  quoteTotal: number
  reasonLabelKey:
    | 'weekday'
    | 'weekend'
    | 'dec_jan'
    | 'cdl_holiday'
    | 'us_holiday'
    | 'none'
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export { parseEventDateParts } from '../usHolidays'

/** 0=Sun … 6=Sat, using local calendar date. */
export function getWeekdayFromParts(parts: EventDateParts): number {
  return new Date(parts.year, parts.month - 1, parts.day).getDay()
}

export function resolveApplicableMinimum(
  parts: EventDateParts | null,
  rules: CommercialMinimumRules,
): { amount: number; reasonLabelKey: CommercialAdjustmentResult['reasonLabelKey'] } {
  if (!parts) {
    return { amount: rules.minOrderWeekday, reasonLabelKey: 'weekday' }
  }

  if (isCdlHolidayDate(parts)) {
    return { amount: rules.holidayMinOrder, reasonLabelKey: 'cdl_holiday' }
  }

  if (parts.month === 12 || parts.month === 1) {
    return { amount: rules.minOrderDecJan, reasonLabelKey: 'dec_jan' }
  }

  const holiday = matchHolidaySurchargeDate(parts)
  if (holiday) {
    return {
      amount: rules.holidayMinOrder,
      reasonLabelKey: holiday.federal ? 'us_holiday' : 'cdl_holiday',
    }
  }

  const weekday = getWeekdayFromParts(parts)
  // Fri(5), Sat(6), Sun(0)
  if (weekday === 0 || weekday === 5 || weekday === 6) {
    return { amount: rules.minOrderWeekend, reasonLabelKey: 'weekend' }
  }

  return { amount: rules.minOrderWeekday, reasonLabelKey: 'weekday' }
}

/**
 * Applies CDL 2026 seasonal floors and surcharges.
 * Special dates (Dec 24/25/31, Jan 1): +100% on the package meat component only.
 * Other US federal holidays outside Dec/Jan keep the previous full-subtotal surcharge.
 * `baseSubtotal` = package + sides + extras + mileage + grill.
 */
export function applyCommercialMinimums(
  baseSubtotal: number,
  eventDate: string | null | undefined,
  rules: CommercialMinimumRules,
  options?: CommercialAdjustmentOptions,
): CommercialAdjustmentResult {
  const base = roundMoney(Math.max(0, Number(baseSubtotal) || 0))
  const parts = parseEventDateParts(eventDate)
  const holiday = parts ? matchHolidaySurchargeDate(parts) : null
  const isSpecialCdlDate = parts ? isCdlHolidayDate(parts) : false
  const isDecemberOrJanuary = parts
    ? parts.month === 12 || parts.month === 1
    : false
  const isWeekend = parts
    ? [0, 5, 6].includes(getWeekdayFromParts(parts))
    : false
  const isOutsideDecJanUsHoliday = Boolean(holiday) && !isDecemberOrJanuary
  const appliesSurcharge = isSpecialCdlDate || isOutsideDecJanUsHoliday

  const holidaySurchargePercent = appliesSurcharge
    ? Math.max(0, Number(rules.holidaySurchargePercent) || 0)
    : 0
  const surchargeBase = isSpecialCdlDate
    ? roundMoney(
        Math.max(
          0,
          Number(
            options?.packageSurchargeBase != null
              ? options.packageSurchargeBase
              : base,
          ) || 0,
        ),
      )
    : base
  const holidaySurchargeAmount = roundMoney(
    surchargeBase * (holidaySurchargePercent / 100),
  )
  const commercialAfterSurcharge = roundMoney(base + holidaySurchargeAmount)

  const { amount: minimumOrderAmount, reasonLabelKey: minReason } =
    resolveApplicableMinimum(parts, rules)

  const minimumOrderAdjustment = roundMoney(
    Math.max(0, minimumOrderAmount - commercialAfterSurcharge),
  )
  const minimumOrderApplied = minimumOrderAdjustment > 0
  const quoteTotal = roundMoney(
    commercialAfterSurcharge + minimumOrderAdjustment,
  )

  const reasonLabelKey: CommercialAdjustmentResult['reasonLabelKey'] = isSpecialCdlDate
    ? 'cdl_holiday'
    : isOutsideDecJanUsHoliday
      ? 'us_holiday'
      : minimumOrderApplied
        ? minReason
        : 'none'

  return {
    isHolidaySurchargeDate: appliesSurcharge,
    isSpecialCdlDate,
    isCdlHoliday: appliesSurcharge,
    holidayKey: isSpecialCdlDate
      ? holiday?.key ?? 'cdl_special_date'
      : isOutsideDecJanUsHoliday
        ? holiday?.key ?? null
        : null,
    holidayLabel: isSpecialCdlDate
      ? holiday?.label ?? 'Data especial CDL'
      : isOutsideDecJanUsHoliday
        ? holiday?.label ?? null
        : null,
    isDecemberOrJanuary,
    isWeekend,
    holidaySurchargePercent,
    holidaySurchargeAmount,
    commercialAfterSurcharge,
    minimumOrderAmount,
    minimumOrderApplied,
    minimumOrderAdjustment,
    quoteTotal,
    reasonLabelKey,
  }
}
