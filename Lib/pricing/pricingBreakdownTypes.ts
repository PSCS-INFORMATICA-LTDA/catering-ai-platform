import type { GuestCounts } from '@/Lib/calculateQuoteTotals'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'

/** Versão semântica do engine — incrementar quando a fórmula ou schema mudar. */
export const PRICING_ENGINE_VERSION = '1.0.0'

export const PRICING_BREAKDOWN_SCHEMA_VERSION = 1

export type PricingBreakdownSourceType =
  | 'package'
  | 'catalog_item'
  | 'commercial_rule'
  | 'guest_adjustment'
  | 'mileage'
  | 'grill_rental'
  | 'discount'
  | 'computed'

export type PricingBreakdownLineKey =
  | 'package'
  | 'additional_item'
  | 'guest_billable'
  | 'guest_physical'
  | 'mileage'
  | 'grill_rental'
  | 'holiday_surcharge'
  | 'minimum_order'
  | 'discount'
  | 'subtotal'
  | 'deposit'
  | 'balance'
  | 'total'

export type PricingBreakdownLine = {
  line_key: PricingBreakdownLineKey | string
  source_type: PricingBreakdownSourceType
  source_id?: string | null
  rule_id?: string | null
  version_id?: string | null
  description: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
  formula?: string | null
  metadata?: Record<string, unknown>
}

export type PricingBreakdown = {
  schema_version: number
  lines: PricingBreakdownLine[]
  adjustments: PricingBreakdownLine[]
  subtotal: number
  total: number
  deposit: number
  balance: number
  rules_applied: CommercialRulesSnapshot
  guest_counts: GuestCounts & {
    billable_guest_count: number
    physical_guest_count: number
  }
  computed_at: string
  engine_version: string
}

export type PricingConfigurationError = {
  code: 'missing_package' | 'missing_package_price' | 'missing_catalog_item' | 'missing_catalog_price' | 'missing_commercial_rule'
  message: string
  field?: string
}

export function isPricingBreakdown(value: unknown): value is PricingBreakdown {
  if (!value || typeof value !== 'object') return false
  const row = value as PricingBreakdown
  return (
    Array.isArray(row.lines) &&
    typeof row.total === 'number' &&
    typeof row.engine_version === 'string'
  )
}
