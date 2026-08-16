import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'
import type { PricingConfigurationError } from './pricingBreakdownTypes'

const REQUIRED_NUMERIC_RULES: Array<{
  key: keyof CommercialRulesSnapshot
  label: string
}> = [
  { key: 'mileageFreeLimit', label: 'mileage_free_limit' },
  { key: 'mileageRate', label: 'mileage_rate' },
  { key: 'reservationPercentage', label: 'reservation_percentage' },
  { key: 'minOrderWeekday', label: 'min_order_weekday' },
  { key: 'minOrderWeekend', label: 'min_order_weekend' },
  { key: 'minOrderDecJan', label: 'min_order_dec_jan' },
  { key: 'holidaySurchargePercent', label: 'holiday_surcharge_percent' },
  { key: 'holidayMinOrder', label: 'holiday_min_order' },
]

function isConfiguredNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Valida regras comerciais carregadas do cadastro.
 * Diferencia 0 configurado (válido) de ausência (null/undefined/NaN).
 */
export function validateCommercialRulesSnapshot(
  rules: CommercialRulesSnapshot,
  options?: { requireSupabaseSource?: boolean },
): PricingConfigurationError | null {
  if (options?.requireSupabaseSource && rules.source !== 'supabase') {
    return {
      code: 'missing_commercial_rule',
      message:
        'Regras comerciais não configuradas para esta empresa. Cadastre commercial_rules no Supabase DEV.',
      field: 'commercial_rules',
    }
  }

  if (!rules.mileageBaseLocation?.trim()) {
    return {
      code: 'missing_commercial_rule',
      message: 'Origem de milhagem (mileage_base_location) não configurada.',
      field: 'mileage_base_location',
    }
  }

  for (const rule of REQUIRED_NUMERIC_RULES) {
    const value = rules[rule.key]
    if (!isConfiguredNumber(value)) {
      return {
        code: 'missing_commercial_rule',
        message: `Regra comercial ausente ou inválida: ${rule.label}.`,
        field: rule.label,
      }
    }
  }

  return null
}
