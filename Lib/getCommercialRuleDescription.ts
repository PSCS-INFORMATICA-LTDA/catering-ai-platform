import type { CommercialRuleValue } from './commercialRulesTableSchema'

/** Rótulos locais — fallback quando `rule_value.label_pt` ausente. */
const RULE_DESCRIPTIONS: Record<string, string> = {
  deposit_percentage: 'Percentual padrão de reserva/sinal',
  reservation_percentage: 'Alias de deposit_percentage',
  mileage_base_location: 'Base de cálculo de milhagem',
  mileage_free_limit: 'Milhas gratuitas a partir da base',
  mileage_rate: 'Taxa por milha acima do limite (USD)',
  children_under_3_factor: 'Fator de cobrança crianças até 3 anos',
  children_4_to_12_factor: 'Fator de cobrança crianças 4–12 anos',
  quote_validity_days: 'Validade padrão da cotação (dias)',
  cancellation_policy_pt: 'Política de cancelamento (PT)',
  holiday_policy_pt: 'Política de feriados (PT)',
  commercial_notes_pt: 'Observações comerciais (PT)',
  child_free_age_max: 'Idade máxima criança grátis',
  child_half_age_max: 'Idade máxima meia criança',
  sides_price_per_person: 'Guarnições por pessoa',
  distance_display_unit: 'Unidade de distância na interface (miles, km ou both)',
  min_order_weekday: 'Pedido mínimo seg–qui',
  min_order_weekend: 'Pedido mínimo sex–dom',
  min_order_dec_jan: 'Pedido mínimo dez/jan',
  holiday_surcharge_percent: 'Acréscimo feriado (%)',
  holiday_min_order: 'Mínimo em feriado',
  minimum_order_amount: 'Valor mínimo de pedido',
  grill_photo_required_default: 'Exigir foto da churrasqueira por padrão',
}

export function getCommercialRuleDescription(
  ruleKey: string,
  ruleValue?: CommercialRuleValue | null,
): string {
  const labelFromValue = ruleValue?.label_pt?.trim()
  if (labelFromValue) return labelFromValue

  const key = ruleKey.trim()
  if (!key) return '—'
  return RULE_DESCRIPTIONS[key] ?? key.replaceAll('_', ' ')
}
