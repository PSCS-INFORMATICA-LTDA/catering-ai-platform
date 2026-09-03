/**
 * Feriados federais dos EUA + datas comemorativas CDL extras.
 * Usados para acréscimo comercial (holiday surcharge) e pedido mínimo de feriado.
 *
 * Observância federal (fixed dates):
 * - cai no sábado → sexta observada
 * - cai no domingo → segunda observada
 */

export type HolidayDateParts = {
  year: number
  month: number
  day: number
}

/** Parse YYYY-MM-DD from the event local calendar date. Never shift via UTC. */
export function parseEventDateParts(
  isoDate: string | null | undefined,
): HolidayDateParts | null {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export type UsHolidayMatch = {
  key: string
  label: string
  /** true = feriado federal EUA; false = data extra CDL (24/31 dez). */
  federal: boolean
  observed: boolean
}

/** Datas extras CDL (além dos feriados federais) com acréscimo 100%. */
export const CDL_EXTRA_SURCHARGE_DATES = [
  { month: 12, day: 24, key: 'cdl_dec_24', label: '24 de dezembro (CDL)' },
  { month: 12, day: 31, key: 'cdl_dec_31', label: '31 de dezembro (CDL)' },
] as const

/** @deprecated Prefer isHolidaySurchargeDate — mantido para compat. */
export const HOLIDAY_DATES = [
  { month: 12, day: 24, label: '24 de dezembro' },
  { month: 12, day: 25, label: '25 de dezembro' },
  { month: 12, day: 31, label: '31 de dezembro' },
  { month: 1, day: 1, label: '1 de janeiro' },
] as const

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): HolidayDateParts {
  // weekday: 0=Sun … 6=Sat; month 1–12
  const first = new Date(year, month - 1, 1)
  const firstWeekday = first.getDay()
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
  return { year, month, day }
}

function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
): HolidayDateParts {
  const last = new Date(year, month, 0) // last day of month
  const lastWeekday = last.getDay()
  const day = last.getDate() - ((lastWeekday - weekday + 7) % 7)
  return { year, month, day }
}

function addObserved(
  year: number,
  month: number,
  day: number,
  key: string,
  label: string,
  into: Map<string, UsHolidayMatch>,
) {
  const actual = new Date(year, month - 1, day)
  const dow = actual.getDay()
  into.set(`${year}-${month}-${day}`, {
    key,
    label,
    federal: true,
    observed: false,
  })

  if (dow === 6) {
    // Saturday → Friday
    const obs = new Date(year, month - 1, day - 1)
    into.set(`${obs.getFullYear()}-${obs.getMonth() + 1}-${obs.getDate()}`, {
      key: `${key}_observed`,
      label: `${label} (observado)`,
      federal: true,
      observed: true,
    })
  } else if (dow === 0) {
    // Sunday → Monday
    const obs = new Date(year, month - 1, day + 1)
    into.set(`${obs.getFullYear()}-${obs.getMonth() + 1}-${obs.getDate()}`, {
      key: `${key}_observed`,
      label: `${label} (observado)`,
      federal: true,
      observed: true,
    })
  }
}

function putFloating(
  parts: HolidayDateParts,
  key: string,
  label: string,
  into: Map<string, UsHolidayMatch>,
) {
  into.set(`${parts.year}-${parts.month}-${parts.day}`, {
    key,
    label,
    federal: true,
    observed: false,
  })
}

/** Mapa year-month-day → holiday para um ano civil. */
export function buildUsHolidayMap(year: number): Map<string, UsHolidayMatch> {
  const map = new Map<string, UsHolidayMatch>()

  // Fixed federal (+ observed)
  addObserved(year, 1, 1, 'new_years_day', "New Year's Day", map)
  addObserved(year, 6, 19, 'juneteenth', 'Juneteenth', map)
  addObserved(year, 7, 4, 'independence_day', 'Independence Day', map)
  addObserved(year, 11, 11, 'veterans_day', 'Veterans Day', map)
  addObserved(year, 12, 25, 'christmas_day', 'Christmas Day', map)

  // Floating federal
  putFloating(
    nthWeekdayOfMonth(year, 1, 1, 3),
    'mlk_day',
    'Martin Luther King Jr. Day',
    map,
  )
  putFloating(
    nthWeekdayOfMonth(year, 2, 1, 3),
    'presidents_day',
    "Presidents' Day",
    map,
  )
  putFloating(
    lastWeekdayOfMonth(year, 5, 1),
    'memorial_day',
    'Memorial Day',
    map,
  )
  putFloating(
    nthWeekdayOfMonth(year, 9, 1, 1),
    'labor_day',
    'Labor Day',
    map,
  )
  putFloating(
    nthWeekdayOfMonth(year, 10, 1, 2),
    'columbus_day',
    'Columbus Day / Indigenous Peoples’ Day',
    map,
  )
  putFloating(
    nthWeekdayOfMonth(year, 11, 4, 4),
    'thanksgiving',
    'Thanksgiving Day',
    map,
  )

  // CDL extras (sempre acréscimo; não “observed”)
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

export function matchHolidaySurchargeDate(
  parts: HolidayDateParts,
): UsHolidayMatch | null {
  const map = buildUsHolidayMap(parts.year)
  return map.get(`${parts.year}-${parts.month}-${parts.day}`) ?? null
}

export function isHolidaySurchargeDate(parts: HolidayDateParts): boolean {
  return matchHolidaySurchargeDate(parts) != null
}

/** Compat: datas CDL clássicas (subset). Prefer isHolidaySurchargeDate. */
export function isCdlHolidayDate(parts: HolidayDateParts): boolean {
  return (
    (parts.month === 12 &&
      (parts.day === 24 || parts.day === 25 || parts.day === 31)) ||
    (parts.month === 1 && parts.day === 1)
  )
}
