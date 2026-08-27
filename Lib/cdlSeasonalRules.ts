import { SIDES_PRICE_PER_PERSON } from './cdlCommercialRules'
import {
  isCdlHolidayDate,
  parseEventDateParts,
  type HolidayDateParts,
} from './usHolidays'
import type { QuoteLanguage } from './quoteWizardTypes'

/** Event calendar date only — never convert through UTC. */
export function eventDateParts(
  isoDate: string | null | undefined,
): HolidayDateParts | null {
  return parseEventDateParts(isoDate)
}

export function isSpecialCdlEventDate(
  isoDate: string | null | undefined,
): boolean {
  const parts = eventDateParts(isoDate)
  return parts ? isCdlHolidayDate(parts) : false
}

export function isDecemberOrJanuaryDate(
  isoDate: string | null | undefined,
): boolean {
  const parts = eventDateParts(isoDate)
  return parts ? parts.month === 12 || parts.month === 1 : false
}

/** Plus packages bake US$13 sides into price_per_person. Holiday +100% never doubles that. */
export function includedSidesPricePerPerson(
  packageKey?: string | null,
): number {
  const key = (packageKey ?? '').trim()
  return key.endsWith('+') ? SIDES_PRICE_PER_PERSON : 0
}

export function packageMeatPricePerPerson(
  packagePricePerPerson: number,
  packageKey?: string | null,
): number {
  const price = Math.max(0, Number(packagePricePerPerson) || 0)
  return Math.max(0, Math.round((price - includedSidesPricePerPerson(packageKey)) * 100) / 100)
}

/** Display-only. Never mutates catalog `price_per_person`. Sides stay un-doubled. */
export function specialDateEffectivePackagePrice(input: {
  packagePricePerPerson: number
  packageKey?: string | null
  surchargePercent?: number
}): {
  original: number
  meat: number
  sides: number
  effectiveMeat: number
  effective: number
} {
  const original = Math.max(0, Number(input.packagePricePerPerson) || 0)
  const sides = includedSidesPricePerPerson(input.packageKey)
  const meat = packageMeatPricePerPerson(original, input.packageKey)
  const percent = Math.max(0, Number(input.surchargePercent) || 0)
  const effectiveMeat = Math.round(meat * (1 + percent / 100) * 100) / 100
  return {
    original,
    meat,
    sides,
    effectiveMeat,
    effective: Math.round((effectiveMeat + sides) * 100) / 100,
  }
}

export type SpecialEventDateNotice = {
  title: string
  lines: readonly string[]
}

const SPECIAL_NOTICE: Record<QuoteLanguage, SpecialEventDateNotice> = {
  pt: {
    title: 'DATA ESPECIAL',
    lines: [
      'Nesta data os pacotes possuem acréscimo de 100%.',
      'Pedido mínimo: US$2.000.',
      'Sem reembolso ou reagendamento.',
    ],
  },
  en: {
    title: 'SPECIAL DATE',
    lines: [
      'On this date packages have a 100% surcharge.',
      'Minimum order: US$2,000.',
      'No refund or reschedule.',
    ],
  },
  es: {
    title: 'FECHA ESPECIAL',
    lines: [
      'En esta fecha los paquetes tienen un recargo del 100%.',
      'Pedido mínimo: US$2.000.',
      'Sin reembolso ni reprogramación.',
    ],
  },
}

export function getSpecialEventDateNotice(
  language: QuoteLanguage | string | null | undefined,
): SpecialEventDateNotice {
  if (language === 'en' || language === 'es') return SPECIAL_NOTICE[language]
  return SPECIAL_NOTICE.pt
}
