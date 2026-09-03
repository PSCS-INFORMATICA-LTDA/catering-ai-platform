import {
  CHILD_FREE_AGE_MAX,
  CHILD_HALF_AGE_MAX,
  CREW_SETUP_LEAD_MINUTES,
  HOLIDAY_MIN_ORDER,
  HOLIDAY_SURCHARGE_PERCENT,
  MILEAGE_BASE_LOCATION,
  MILEAGE_FREE_LIMIT,
  MILEAGE_RATE,
  MIN_ORDER_DEC_JAN,
  MIN_ORDER_WEEKDAY,
  MIN_ORDER_WEEKEND,
  RESERVATION_PERCENTAGE,
  SERVICE_DURATION_HOURS,
  SIDES_PRICE_PER_PERSON,
} from './cdlCommercialRules'
import {
  parseDistanceDisplayUnit,
  type DistanceDisplayUnit,
} from './units'
import { getActiveCompanyId } from '@/Lib/tenant/resolveTenant'
import { getSupabaseServerClient } from './supabaseServer'

export type CommercialRulesSnapshot = {
  mileageBaseLocation: string
  mileageFreeLimit: number
  mileageRate: number
  reservationPercentage: number
  sidesPricePerPerson: number
  /** Presentation only. Mileage pricing always uses miles. */
  distanceDisplayUnit: DistanceDisplayUnit
  minOrderWeekday: number
  minOrderWeekend: number
  minOrderDecJan: number
  holidaySurchargePercent: number
  holidayMinOrder: number
  childFreeAgeMax: number
  childHalfAgeMax: number
  serviceDurationHours: number
  crewSetupLeadMinutes: number
  source: 'supabase' | 'fallback'
}

const RULE_TABLE_CANDIDATES = ['commercial_rules', 'pricing_rules'] as const

type RuleRow = Record<string, unknown>

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toText(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

function extractRuleScalar(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'value' in (raw as object)) {
    return (raw as { value: unknown }).value
  }
  return raw
}

export function getFallbackCommercialRules(): CommercialRulesSnapshot {
  return {
    mileageBaseLocation: MILEAGE_BASE_LOCATION,
    mileageFreeLimit: MILEAGE_FREE_LIMIT,
    mileageRate: MILEAGE_RATE,
    reservationPercentage: RESERVATION_PERCENTAGE,
    sidesPricePerPerson: SIDES_PRICE_PER_PERSON,
    distanceDisplayUnit: 'both',
    minOrderWeekday: MIN_ORDER_WEEKDAY,
    minOrderWeekend: MIN_ORDER_WEEKEND,
    minOrderDecJan: MIN_ORDER_DEC_JAN,
    holidaySurchargePercent: HOLIDAY_SURCHARGE_PERCENT,
    holidayMinOrder: HOLIDAY_MIN_ORDER,
    childFreeAgeMax: CHILD_FREE_AGE_MAX,
    childHalfAgeMax: CHILD_HALF_AGE_MAX,
    serviceDurationHours: SERVICE_DURATION_HOURS,
    crewSetupLeadMinutes: CREW_SETUP_LEAD_MINUTES,
    source: 'fallback',
  }
}

function mapKeyValueRules(rows: RuleRow[]): CommercialRulesSnapshot {
  const fallback = getFallbackCommercialRules()
  const byKey = new Map<string, unknown>()

  for (const row of rows) {
    const key = String(row.rule_key ?? row.key ?? row.name ?? '').trim()
    if (!key) continue
    if (row.active === false) continue
    byKey.set(
      key,
      extractRuleScalar(
        row.numeric_value ??
          row.number_value ??
          row.text_value ??
          row.rule_value ??
          row.value,
      ),
    )
  }

  return {
    mileageBaseLocation: toText(
      byKey.get('mileage_base_location'),
      fallback.mileageBaseLocation,
    ),
    mileageFreeLimit: toNumber(
      byKey.get('mileage_free_limit'),
      fallback.mileageFreeLimit,
    ),
    mileageRate: toNumber(byKey.get('mileage_rate'), fallback.mileageRate),
    reservationPercentage: toNumber(
      byKey.get('reservation_percentage') ?? byKey.get('deposit_percentage'),
      fallback.reservationPercentage,
    ),
    sidesPricePerPerson: toNumber(
      byKey.get('sides_price_per_person'),
      fallback.sidesPricePerPerson,
    ),
    distanceDisplayUnit: parseDistanceDisplayUnit(
      byKey.get('distance_display_unit'),
    ),
    minOrderWeekday: toNumber(
      byKey.get('min_order_weekday'),
      fallback.minOrderWeekday,
    ),
    minOrderWeekend: toNumber(
      byKey.get('min_order_weekend'),
      fallback.minOrderWeekend,
    ),
    minOrderDecJan: toNumber(
      byKey.get('min_order_dec_jan'),
      fallback.minOrderDecJan,
    ),
    holidaySurchargePercent: toNumber(
      byKey.get('holiday_surcharge_percent'),
      fallback.holidaySurchargePercent,
    ),
    holidayMinOrder: toNumber(
      byKey.get('holiday_min_order'),
      fallback.holidayMinOrder,
    ),
    childFreeAgeMax: toNumber(
      byKey.get('child_free_age_max'),
      fallback.childFreeAgeMax,
    ),
    childHalfAgeMax: toNumber(
      byKey.get('child_half_age_max'),
      fallback.childHalfAgeMax,
    ),
    serviceDurationHours: toNumber(
      byKey.get('service_duration_hours'),
      fallback.serviceDurationHours,
    ),
    crewSetupLeadMinutes: toNumber(
      byKey.get('crew_setup_lead_minutes'),
      fallback.crewSetupLeadMinutes,
    ),
    source: 'supabase',
  }
}

function mapSingleRowRules(row: RuleRow): CommercialRulesSnapshot {
  const fallback = getFallbackCommercialRules()

  return {
    mileageBaseLocation: toText(
      row.mileage_base_location,
      fallback.mileageBaseLocation,
    ),
    mileageFreeLimit: toNumber(
      row.mileage_free_limit,
      fallback.mileageFreeLimit,
    ),
    mileageRate: toNumber(row.mileage_rate, fallback.mileageRate),
    reservationPercentage: toNumber(
      row.reservation_percentage,
      fallback.reservationPercentage,
    ),
    sidesPricePerPerson: toNumber(
      row.sides_price_per_person,
      fallback.sidesPricePerPerson,
    ),
    distanceDisplayUnit: parseDistanceDisplayUnit(
      row.distance_display_unit,
    ),
    minOrderWeekday: toNumber(row.min_order_weekday, fallback.minOrderWeekday),
    minOrderWeekend: toNumber(row.min_order_weekend, fallback.minOrderWeekend),
    minOrderDecJan: toNumber(row.min_order_dec_jan, fallback.minOrderDecJan),
    holidaySurchargePercent: toNumber(
      row.holiday_surcharge_percent,
      fallback.holidaySurchargePercent,
    ),
    holidayMinOrder: toNumber(row.holiday_min_order, fallback.holidayMinOrder),
    childFreeAgeMax: toNumber(row.child_free_age_max, fallback.childFreeAgeMax),
    childHalfAgeMax: toNumber(
      row.child_half_age_max,
      fallback.childHalfAgeMax,
    ),
    serviceDurationHours: toNumber(
      row.service_duration_hours,
      fallback.serviceDurationHours,
    ),
    crewSetupLeadMinutes: toNumber(
      row.crew_setup_lead_minutes,
      fallback.crewSetupLeadMinutes,
    ),
    source: 'supabase',
  }
}

function parseCommercialRulesRows(rows: RuleRow[]): CommercialRulesSnapshot {
  if (rows.length === 0) return getFallbackCommercialRules()

  const first = rows[0]!
  if ('rule_key' in first || 'key' in first) {
    return mapKeyValueRules(rows)
  }

  if ('mileage_base_location' in first || 'mileage_free_limit' in first) {
    return mapSingleRowRules(first)
  }

  return getFallbackCommercialRules()
}

export async function fetchSupabaseCommercialRules(
  companyIdOverride?: string | null,
): Promise<CommercialRulesSnapshot> {
  const companyId = companyIdOverride?.trim() || getActiveCompanyId()
  const supabase = getSupabaseServerClient()

  for (const table of RULE_TABLE_CANDIDATES) {
    let query = supabase
      .from(table)
      .select(
        'id, company_id, rule_key, rule_value, active, created_at, updated_at, rule_type',
      )
    if (companyId?.trim()) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`)
    }
    const { data, error } = await query

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[CDL Pricing] Could not load ${table} from Supabase:`,
          error.message,
        )
      }
      continue
    }

    if (data?.length) {
      return parseCommercialRulesRows(data as RuleRow[])
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[CDL Pricing] Using fallback commercial rules (no Supabase pricing table rows).',
    )
  }

  return getFallbackCommercialRules()
}
