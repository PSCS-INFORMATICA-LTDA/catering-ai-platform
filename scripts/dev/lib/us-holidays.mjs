/**
 * Espelho de Lib/usHolidays.ts para scripts Node (sem TS).
 * Feriados federais EUA + extras CDL (24/31 dez) → acréscimo comercial.
 */

export const CDL_EXTRA_SURCHARGE_DATES = [
  { month: 12, day: 24, key: 'cdl_dec_24', label: '24 de dezembro (CDL)' },
  { month: 12, day: 31, key: 'cdl_dec_31', label: '31 de dezembro (CDL)' },
]

function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1)
  const firstWeekday = first.getDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
  return { year, month, day }
}

function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(year, month, 0)
  const lastWeekday = last.getDay()
  const day = last.getDate() - ((lastWeekday - weekday + 7) % 7)
  return { year, month, day }
}

function addObserved(year, month, day, key, label, into) {
  const actual = new Date(year, month - 1, day)
  const dow = actual.getDay()
  into.set(`${year}-${month}-${day}`, {
    key,
    label,
    federal: true,
    observed: false,
  })
  if (dow === 6) {
    const obs = new Date(year, month - 1, day - 1)
    into.set(`${obs.getFullYear()}-${obs.getMonth() + 1}-${obs.getDate()}`, {
      key: `${key}_observed`,
      label: `${label} (observado)`,
      federal: true,
      observed: true,
    })
  } else if (dow === 0) {
    const obs = new Date(year, month - 1, day + 1)
    into.set(`${obs.getFullYear()}-${obs.getMonth() + 1}-${obs.getDate()}`, {
      key: `${key}_observed`,
      label: `${label} (observado)`,
      federal: true,
      observed: true,
    })
  }
}

function putFloating(parts, key, label, into) {
  into.set(`${parts.year}-${parts.month}-${parts.day}`, {
    key,
    label,
    federal: true,
    observed: false,
  })
}

export function buildUsHolidayMap(year) {
  const map = new Map()
  addObserved(year, 1, 1, 'new_years_day', "New Year's Day", map)
  addObserved(year, 6, 19, 'juneteenth', 'Juneteenth', map)
  addObserved(year, 7, 4, 'independence_day', 'Independence Day', map)
  addObserved(year, 11, 11, 'veterans_day', 'Veterans Day', map)
  addObserved(year, 12, 25, 'christmas_day', 'Christmas Day', map)

  putFloating(nthWeekdayOfMonth(year, 1, 1, 3), 'mlk_day', 'Martin Luther King Jr. Day', map)
  putFloating(nthWeekdayOfMonth(year, 2, 1, 3), 'presidents_day', "Presidents' Day", map)
  putFloating(lastWeekdayOfMonth(year, 5, 1), 'memorial_day', 'Memorial Day', map)
  putFloating(nthWeekdayOfMonth(year, 9, 1, 1), 'labor_day', 'Labor Day', map)
  putFloating(
    nthWeekdayOfMonth(year, 10, 1, 2),
    'columbus_day',
    'Columbus Day / Indigenous Peoples’ Day',
    map,
  )
  putFloating(nthWeekdayOfMonth(year, 11, 4, 4), 'thanksgiving', 'Thanksgiving Day', map)

  for (const extra of CDL_EXTRA_SURCHARGE_DATES) {
    map.set(`${year}-${extra.month}-${extra.day}`, {
      key: extra.key,
      label: extra.label,
      federal: false,
      observed: false,
    })
  }
  return map
}

export function parseEventDateParts(isoDate) {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate).trim())
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

export function matchHolidaySurchargeDate(parts) {
  if (!parts) return null
  return buildUsHolidayMap(parts.year).get(
    `${parts.year}-${parts.month}-${parts.day}`,
  ) ?? null
}

export function isHolidaySurchargeDate(parts) {
  return matchHolidaySurchargeDate(parts) != null
}

export function getWeekdayFromParts(parts) {
  return new Date(parts.year, parts.month - 1, parts.day).getDay()
}

export function applyCommercialMinimums(baseSubtotal, eventDate, rules) {
  const roundMoney = (n) => Math.round(Number(n) * 100) / 100
  const base = roundMoney(Math.max(0, Number(baseSubtotal) || 0))
  const parts = parseEventDateParts(eventDate)
  const holiday = parts ? matchHolidaySurchargeDate(parts) : null
  const isHoliday = Boolean(holiday)
  const holidaySurchargePercent = isHoliday
    ? Math.max(0, Number(rules.holidaySurchargePercent) || 0)
    : 0
  const holidaySurchargeAmount = roundMoney(
    (base * holidaySurchargePercent) / 100,
  )
  const commercialAfterSurcharge = roundMoney(base + holidaySurchargeAmount)

  let minimumOrderAmount = rules.minOrderWeekday
  let minKey = 'weekday'
  if (parts) {
    if (holiday) {
      minimumOrderAmount = rules.holidayMinOrder
      minKey = holiday.federal ? 'us_holiday' : 'cdl_holiday'
    } else if (parts.month === 12 || parts.month === 1) {
      minimumOrderAmount = rules.minOrderDecJan
      minKey = 'dec_jan'
    } else {
      const weekday = getWeekdayFromParts(parts)
      if (weekday === 0 || weekday === 5 || weekday === 6) {
        minimumOrderAmount = rules.minOrderWeekend
        minKey = 'weekend'
      }
    }
  }

  const minimumOrderAdjustment = roundMoney(
    Math.max(0, minimumOrderAmount - commercialAfterSurcharge),
  )
  const quoteTotal = roundMoney(
    commercialAfterSurcharge + minimumOrderAdjustment,
  )
  return {
    isHolidaySurchargeDate: isHoliday,
    isCdlHoliday: isHoliday,
    holidayKey: holiday?.key ?? null,
    holidayLabel: holiday?.label ?? null,
    holidaySurchargeAmount,
    commercialAfterSurcharge,
    minimumOrderAmount,
    minimumOrderApplied: minimumOrderAdjustment > 0,
    minimumOrderAdjustment,
    quoteTotal,
    minKey: minimumOrderAdjustment > 0 ? minKey : 'none',
  }
}
