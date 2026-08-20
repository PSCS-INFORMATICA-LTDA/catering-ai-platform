import {
  isHolidaySurchargeDate,
  matchHolidaySurchargeDate,
  type HolidayDateParts,
} from '@/Lib/usHolidays'

export type CommercialMinimumRules = {
  minOrderWeekday: number
  minOrderWeekend: number
  minOrderDecJan: number
  holidaySurchargePercent: number
  holidayMinOrder: number
}

export type EventDateParts = HolidayDateParts

export type CommercialAdjustmentResult = {
  isHolidaySurchargeDate: boolean
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

/** Parse YYYY-MM-DD without UTC timezone shift. */
export function parseEventDateParts(
  isoDate: string | null | undefined,
): EventDateParts | null {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/** @deprecated use isHolidaySurchargeDate from Lib/usHolidays */
export { isHolidaySurchargeDate as isCdlHolidayDate } from '@/Lib/usHolidays'

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

  const holiday = matchHolidaySurchargeDate(parts)
  if (holiday) {
    return {
      amount: rules.holidayMinOrder,
      reasonLabelKey: holiday.federal ? 'us_holiday' : 'cdl_holiday',
    }
  }

  if (parts.month === 12 || parts.month === 1) {
    return { amount: rules.minOrderDecJan, reasonLabelKey: 'dec_jan' }
  }

  const weekday = getWeekdayFromParts(parts)
  // Fri(5), Sat(6), Sun(0)
  if (weekday === 0 || weekday === 5 || weekday === 6) {
    return { amount: rules.minOrderWeekend, reasonLabelKey: 'weekend' }
  }

  return { amount: rules.minOrderWeekday, reasonLabelKey: 'weekday' }
}

/**
 * Aplica acréscimo de feriado (federais EUA + datas CDL 24/31 dez)
 * e eleva ao pedido mínimo (opção 2).
 * `baseSubtotal` = pacote + adicionais + milhagem (antes de regras comerciais).
 */
export function applyCommercialMinimums(
  baseSubtotal: number,
  eventDate: string | null | undefined,
  rules: CommercialMinimumRules,
): CommercialAdjustmentResult {
  const base = roundMoney(Math.max(0, Number(baseSubtotal) || 0))
  const parts = parseEventDateParts(eventDate)
  const holiday = parts ? matchHolidaySurchargeDate(parts) : null
  const isHoliday = Boolean(holiday)
  const isDecemberOrJanuary = parts
    ? parts.month === 12 || parts.month === 1
    : false
  const isWeekend = parts
    ? [0, 5, 6].includes(getWeekdayFromParts(parts))
    : false

  const holidaySurchargePercent = isHoliday
    ? Math.max(0, Number(rules.holidaySurchargePercent) || 0)
    : 0
  const holidaySurchargeAmount = roundMoney(
    base * (holidaySurchargePercent / 100),
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

  const reasonLabelKey: CommercialAdjustmentResult['reasonLabelKey'] = isHoliday
    ? holiday?.federal
      ? 'us_holiday'
      : 'cdl_holiday'
    : minimumOrderApplied
      ? minReason
      : 'none'

  return {
    isHolidaySurchargeDate: isHoliday,
    isCdlHoliday: isHoliday,
    holidayKey: holiday?.key ?? null,
    holidayLabel: holiday?.label ?? null,
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
