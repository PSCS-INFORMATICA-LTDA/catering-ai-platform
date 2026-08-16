import type { CommercialRuleValue } from './commercialRulesTableSchema'
import {
  SUPPLIER_GARNISH_KIT_RULE_KEY,
  buildSupplierGarnishKitRuleValue,
} from './supplierGarnishKitRule'

export type CommercialRuleSeed = {
  rule_key: string
  rule_value: CommercialRuleValue
  active: boolean
}

export const DEFAULT_COMMERCIAL_RULE_SEEDS: CommercialRuleSeed[] = [
  {
    rule_key: 'deposit_percentage',
    rule_value: {
      value: 30,
      type: 'number',
      label_pt: 'Reserva padrão (%)',
    },
    active: true,
  },
  {
    rule_key: 'mileage_base_location',
    rule_value: {
      value: 'Orlando Eye',
      type: 'text',
      label_pt: 'Ponto base de milhagem',
    },
    active: true,
  },
  {
    rule_key: 'mileage_free_limit',
    rule_value: {
      value: 20,
      type: 'number',
      unit: 'mi',
      label_pt: 'Milhas grátis',
    },
    active: true,
  },
  {
    rule_key: 'mileage_rate',
    rule_value: {
      value: 2,
      type: 'number',
      unit: 'USD/mi',
      label_pt: 'Taxa por milha',
    },
    active: true,
  },
  {
    rule_key: 'children_under_3_factor',
    rule_value: {
      value: 0,
      type: 'number',
      label_pt: 'Crianças até 3 anos',
    },
    active: true,
  },
  {
    rule_key: 'children_4_to_12_factor',
    rule_value: {
      value: 0.5,
      type: 'number',
      label_pt: 'Crianças 4 a 12 anos',
    },
    active: true,
  },
  {
    rule_key: 'quote_validity_days',
    rule_value: {
      value: 7,
      type: 'number',
      unit: 'days',
      label_pt: 'Validade da cotação',
    },
    active: true,
  },
  {
    rule_key: 'cancellation_policy_pt',
    rule_value: {
      value: 'Texto da política de cancelamento',
      type: 'long_text',
      label_pt: 'Política de cancelamento',
    },
    active: true,
  },
  {
    rule_key: 'holiday_policy_pt',
    rule_value: {
      value: 'Texto da política de feriados',
      type: 'long_text',
      label_pt: 'Política de feriados',
    },
    active: true,
  },
  {
    rule_key: 'commercial_notes_pt',
    rule_value: {
      value: 'Observações comerciais',
      type: 'long_text',
      label_pt: 'Observações comerciais',
    },
    active: true,
  },
  {
    rule_key: SUPPLIER_GARNISH_KIT_RULE_KEY,
    rule_value: buildSupplierGarnishKitRuleValue(),
    active: true,
  },
]
