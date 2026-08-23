import { tw } from './quoteTranslations.ts'
import type { QuoteLanguage } from './quoteWizardTypes.ts'

export type AdditionalChargeUnit = 'person' | 'unit' | 'portion' | 'fixed'

/** Fields that carry the registered commercial charge rule. */
export type AdditionalChargeSource = {
  pricing_type?: string | null
  charge_type?: string | null
  unit_label?: string | null
  unit?: string | null
}

const GENERIC_UNIT_CODES = ['UN', 'UNIT', 'UNIDADE', 'UNIDAD', 'EA']

/** Reads pricing_type/charge_type as registered — no presentation-only enum. */
export function getAdditionalChargeUnit(
  item: AdditionalChargeSource,
): AdditionalChargeUnit {
  const pricingType = (item.pricing_type ?? '').trim().toUpperCase()
  const chargeType = (item.charge_type ?? '').trim().toUpperCase()
  if (pricingType === 'PER_PERSON' || chargeType === 'PERSON') return 'person'

  const raw = pricingType || chargeType
  if (raw === 'FIXED' || raw === 'FIXED_PRICE') return 'fixed'
  if (raw.includes('PORTION') || raw.includes('PORCAO')) return 'portion'
  return 'unit'
}

/**
 * Charge unit shown next to the price. A registered unit_label that is not a
 * generic unit code (e.g. "bandeja") wins, because it is the real commercial unit.
 */
export function getAdditionalChargeUnitLabel(
  item: AdditionalChargeSource,
  language: QuoteLanguage,
): string {
  const chargeUnit = getAdditionalChargeUnit(item)
  if (chargeUnit === 'person') return tw(language, 'chargeUnitPerPerson')
  if (chargeUnit === 'fixed') return tw(language, 'chargeUnitFixed')
  if (chargeUnit === 'portion') return tw(language, 'chargeUnitPerPortion')

  const unitLabel = (item.unit_label || item.unit || '').trim()
  if (unitLabel && !GENERIC_UNIT_CODES.includes(unitLabel.toUpperCase())) {
    return unitLabel
  }
  return tw(language, 'chargeUnitPerUnit')
}
