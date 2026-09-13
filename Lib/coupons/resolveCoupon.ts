import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { normalizePhone } from '@/Lib/normalizePhone'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'

export type CouponStatus = 'draft' | 'active' | 'paused' | 'archived'
export type CouponDiscountType = 'fixed' | 'percent'

export type CouponRecord = {
  id: string
  company_id: string
  code: string
  campaign_name: string
  description: string | null
  status: CouponStatus
  discount_type: CouponDiscountType
  discount_value: number
  max_discount_amount: number | null
  min_eligible_amount: number
  valid_from: string | null
  valid_to: string | null
  eligible_weekdays: number[]
  all_packages: boolean
  eligible_package_ids: string[]
  include_additionals: boolean
  include_grill: boolean
  include_additional_cuts: boolean
  include_mileage: boolean
  new_customer_only: boolean
  max_uses_per_customer: number | null
  max_uses_per_quote: number
  stackable: boolean
  apply_to_deposit: boolean
  apply_to_balance: boolean
  allow_post_event_adjustment: boolean
  manual_approval_required: boolean
  distribution_channel: string | null
  minimum_final_mon_thu: number | null
  minimum_final_fri_sun: number | null
  metadata: Record<string, unknown>
}

export type CouponRejectReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'weekday_not_allowed'
  | 'package_not_allowed'
  | 'minimum_not_reached'
  | 'customer_not_eligible'
  | 'usage_limit_reached'
  | 'nothing_eligible'
  | 'invalid_configuration'

export type CouponResolution = {
  valid: boolean
  reason?: CouponRejectReason
  coupon?: CouponRecord
  eligibleAmount: number
  potentialDiscountAmount: number
  appliedDiscountAmount: number
  manualApprovalRequired: boolean
  approvalStatus: 'pending' | 'applied'
  minimumFinalAmount: number | null
  totalBeforeCoupon: number
  totalAfterCoupon: number
  projectedTotalAfterApproval: number
  rulesSnapshot: Record<string, unknown>
}

type ResolveCouponInput = {
  companyId: string
  code: string
  eventDate: string
  packageId: string
  breakdown: PricingBreakdown
  contactPhone?: string | null
}

type CatalogDiscountShape = {
  id: string
  category_pt?: string | null
  item_type?: string | null
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toCouponRecord(value: Record<string, unknown>): CouponRecord {
  return {
    id: String(value.id),
    company_id: String(value.company_id),
    code: String(value.code),
    campaign_name: String(value.campaign_name),
    description: typeof value.description === 'string' ? value.description : null,
    status: value.status as CouponStatus,
    discount_type: value.discount_type as CouponDiscountType,
    discount_value: asNumber(value.discount_value),
    max_discount_amount:
      value.max_discount_amount == null ? null : asNumber(value.max_discount_amount),
    min_eligible_amount: asNumber(value.min_eligible_amount),
    valid_from: typeof value.valid_from === 'string' ? value.valid_from : null,
    valid_to: typeof value.valid_to === 'string' ? value.valid_to : null,
    eligible_weekdays: Array.isArray(value.eligible_weekdays)
      ? value.eligible_weekdays.map(Number).filter(Number.isFinite)
      : [0, 1, 2, 3, 4, 5, 6],
    all_packages: value.all_packages !== false,
    eligible_package_ids: Array.isArray(value.eligible_package_ids)
      ? value.eligible_package_ids.map(String)
      : [],
    include_additionals: value.include_additionals !== false,
    include_grill: value.include_grill === true,
    include_additional_cuts: value.include_additional_cuts === true,
    include_mileage: value.include_mileage === true,
    new_customer_only: value.new_customer_only === true,
    max_uses_per_customer:
      value.max_uses_per_customer == null ? null : asNumber(value.max_uses_per_customer),
    max_uses_per_quote: Math.max(1, asNumber(value.max_uses_per_quote, 1)),
    stackable: value.stackable === true,
    apply_to_deposit: value.apply_to_deposit === true,
    apply_to_balance: value.apply_to_balance !== false,
    allow_post_event_adjustment: value.allow_post_event_adjustment === true,
    manual_approval_required: value.manual_approval_required === true,
    distribution_channel:
      typeof value.distribution_channel === 'string' ? value.distribution_channel : null,
    minimum_final_mon_thu:
      value.minimum_final_mon_thu == null ? null : asNumber(value.minimum_final_mon_thu),
    minimum_final_fri_sun:
      value.minimum_final_fri_sun == null ? null : asNumber(value.minimum_final_fri_sun),
    metadata:
      value.metadata && typeof value.metadata === 'object'
        ? (value.metadata as Record<string, unknown>)
        : {},
  }
}

function eventWeekday(eventDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null
  const date = new Date(`${eventDate}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay()
}

function isAdditionalCut(item: CatalogDiscountShape | undefined): boolean {
  if (!item) return false
  const category = (item.category_pt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return [
    'bovino',
    'cordeiro',
    'frango',
    'frutos do mar',
    'linguica',
    'porco',
    'suino',
  ].some((needle) => category.includes(needle))
}

async function loadCatalogDiscountShapes(
  companyId: string,
  itemIds: string[],
): Promise<Map<string, CatalogDiscountShape>> {
  if (itemIds.length === 0) return new Map()
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('catalog_items')
    .select('id, category_pt, item_type')
    .eq('company_id', companyId)
    .in('id', itemIds)
  return new Map(
    (data ?? []).map((row) => [String(row.id), row as CatalogDiscountShape]),
  )
}

async function customerUsage(
  companyId: string,
  couponId: string,
  phoneValue: string | null | undefined,
): Promise<{ customerExists: boolean; uses: number }> {
  const phone = normalizePhone(phoneValue)
  if (!phone) return { customerExists: false, uses: 0 }
  const db = getSupabaseServerClient()
  const { data: customers, error: customerError } = await db
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone_normalized', phone)
    .eq('active', true)
  if (customerError || !customers?.length) {
    return { customerExists: false, uses: 0 }
  }
  const customerIds = customers.map((row) => String(row.id))
  const { data: quotes, error: quoteError } = await db
    .from('quotes')
    .select('id')
    .eq('company_id', companyId)
    .in('customer_id', customerIds)
  if (quoteError || !quotes?.length) {
    return { customerExists: true, uses: 0 }
  }
  const quoteIds = quotes.map((row) => String(row.id))
  const { count, error: usageError } = await db
    .from('quote_coupon_applications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('coupon_id', couponId)
    .in('quote_id', quoteIds)
    .in('approval_status', ['pending', 'applied'])
  return {
    customerExists: true,
    uses: usageError ? 0 : Number(count ?? 0),
  }
}

function invalidResolution(
  reason: CouponRejectReason,
  total: number,
  coupon?: CouponRecord,
): CouponResolution {
  return {
    valid: false,
    reason,
    coupon,
    eligibleAmount: 0,
    potentialDiscountAmount: 0,
    appliedDiscountAmount: 0,
    manualApprovalRequired: coupon?.manual_approval_required === true,
    approvalStatus: coupon?.manual_approval_required ? 'pending' : 'applied',
    minimumFinalAmount: null,
    totalBeforeCoupon: roundMoney(total),
    totalAfterCoupon: roundMoney(total),
    projectedTotalAfterApproval: roundMoney(total),
    rulesSnapshot: coupon ? buildRulesSnapshot(coupon) : {},
  }
}

function buildRulesSnapshot(coupon: CouponRecord): Record<string, unknown> {
  return {
    code: coupon.code,
    campaign_name: coupon.campaign_name,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    max_discount_amount: coupon.max_discount_amount,
    min_eligible_amount: coupon.min_eligible_amount,
    valid_from: coupon.valid_from,
    valid_to: coupon.valid_to,
    eligible_weekdays: coupon.eligible_weekdays,
    all_packages: coupon.all_packages,
    eligible_package_ids: coupon.eligible_package_ids,
    include_additionals: coupon.include_additionals,
    include_grill: coupon.include_grill,
    include_additional_cuts: coupon.include_additional_cuts,
    include_mileage: coupon.include_mileage,
    new_customer_only: coupon.new_customer_only,
    max_uses_per_customer: coupon.max_uses_per_customer,
    max_uses_per_quote: coupon.max_uses_per_quote,
    stackable: coupon.stackable,
    apply_to_deposit: coupon.apply_to_deposit,
    apply_to_balance: coupon.apply_to_balance,
    allow_post_event_adjustment: coupon.allow_post_event_adjustment,
    manual_approval_required: coupon.manual_approval_required,
    distribution_channel: coupon.distribution_channel,
    minimum_final_mon_thu: coupon.minimum_final_mon_thu,
    minimum_final_fri_sun: coupon.minimum_final_fri_sun,
    metadata: coupon.metadata,
  }
}

export function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) return null
  return code
}

export async function resolveCouponForPricing(
  input: ResolveCouponInput,
): Promise<CouponResolution> {
  const total = roundMoney(input.breakdown.total)
  const code = normalizeCouponCode(input.code)
  if (!code) return invalidResolution('not_found', total)

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('coupons')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return invalidResolution('not_found', total)
  const coupon = toCouponRecord(data as Record<string, unknown>)

  if (coupon.status !== 'active') return invalidResolution('inactive', total, coupon)
  if (!coupon.apply_to_deposit && !coupon.apply_to_balance) {
    return invalidResolution('invalid_configuration', total, coupon)
  }
  if (coupon.valid_from && input.eventDate < coupon.valid_from) {
    return invalidResolution('not_started', total, coupon)
  }
  if (coupon.valid_to && input.eventDate > coupon.valid_to) {
    return invalidResolution('expired', total, coupon)
  }

  const weekday = eventWeekday(input.eventDate)
  if (weekday == null || !coupon.eligible_weekdays.includes(weekday)) {
    return invalidResolution('weekday_not_allowed', total, coupon)
  }
  if (
    !coupon.all_packages &&
    !coupon.eligible_package_ids.includes(input.packageId)
  ) {
    return invalidResolution('package_not_allowed', total, coupon)
  }

  const usage = await customerUsage(
    input.companyId,
    coupon.id,
    input.contactPhone,
  )
  if (coupon.new_customer_only && usage.customerExists) {
    return invalidResolution('customer_not_eligible', total, coupon)
  }
  if (
    coupon.max_uses_per_customer != null &&
    usage.uses >= coupon.max_uses_per_customer
  ) {
    return invalidResolution('usage_limit_reached', total, coupon)
  }

  const additionalIds = input.breakdown.lines
    .filter((line) => line.line_key === 'additional_item' && line.source_id)
    .map((line) => String(line.source_id))
  const catalog = await loadCatalogDiscountShapes(input.companyId, additionalIds)

  let eligibleAmount = 0
  for (const line of input.breakdown.lines) {
    const amount = Math.max(0, asNumber(line.amount))
    if (line.line_key === 'package' || line.line_key === 'package_sides') {
      eligibleAmount += amount
      continue
    }
    if (line.line_key === 'additional_item') {
      if (!coupon.include_additionals) continue
      if (
        !coupon.include_additional_cuts &&
        isAdditionalCut(line.source_id ? catalog.get(String(line.source_id)) : undefined)
      ) {
        continue
      }
      eligibleAmount += amount
      continue
    }
    if (line.line_key === 'grill_rental' && coupon.include_grill) {
      eligibleAmount += amount
      continue
    }
    if (line.line_key === 'mileage' && coupon.include_mileage) {
      eligibleAmount += amount
    }
  }
  eligibleAmount = roundMoney(eligibleAmount)
  if (eligibleAmount <= 0) {
    return invalidResolution('nothing_eligible', total, coupon)
  }
  if (eligibleAmount + 0.0001 < coupon.min_eligible_amount) {
    const result = invalidResolution('minimum_not_reached', total, coupon)
    return { ...result, eligibleAmount }
  }

  let potential =
    coupon.discount_type === 'percent'
      ? eligibleAmount * (coupon.discount_value / 100)
      : coupon.discount_value
  if (coupon.max_discount_amount != null) {
    potential = Math.min(potential, coupon.max_discount_amount)
  }
  potential = Math.min(potential, eligibleAmount, total)

  const monThu = weekday >= 1 && weekday <= 4
  const minimumFinalAmount = monThu
    ? coupon.minimum_final_mon_thu
    : coupon.minimum_final_fri_sun
  if (minimumFinalAmount != null) {
    potential = Math.min(potential, Math.max(0, total - minimumFinalAmount))
  }
  potential = roundMoney(Math.max(0, potential))
  if (potential <= 0) {
    const result = invalidResolution('minimum_not_reached', total, coupon)
    return {
      ...result,
      eligibleAmount,
      minimumFinalAmount,
      rulesSnapshot: buildRulesSnapshot(coupon),
    }
  }

  const applied = coupon.manual_approval_required ? 0 : potential
  return {
    valid: true,
    coupon,
    eligibleAmount,
    potentialDiscountAmount: potential,
    appliedDiscountAmount: applied,
    manualApprovalRequired: coupon.manual_approval_required,
    approvalStatus: coupon.manual_approval_required ? 'pending' : 'applied',
    minimumFinalAmount,
    totalBeforeCoupon: total,
    totalAfterCoupon: roundMoney(total - applied),
    projectedTotalAfterApproval: roundMoney(total - potential),
    rulesSnapshot: buildRulesSnapshot(coupon),
  }
}

export async function persistQuoteCouponApplication(args: {
  companyId: string
  quoteId: string
  resolution: CouponResolution
  breakdown: PricingBreakdown
}): Promise<boolean> {
  const { resolution } = args
  if (!resolution.valid || !resolution.coupon) return true
  const db = getSupabaseServerClient()
  const now = new Date().toISOString()
  const application = await db.from('quote_coupon_applications').upsert(
    {
      company_id: args.companyId,
      quote_id: args.quoteId,
      coupon_id: resolution.coupon.id,
      coupon_code_snapshot: resolution.coupon.code,
      campaign_name_snapshot: resolution.coupon.campaign_name,
      eligible_amount: resolution.eligibleAmount,
      potential_discount_amount: resolution.potentialDiscountAmount,
      applied_discount_amount: resolution.appliedDiscountAmount,
      approval_status: resolution.approvalStatus,
      rules_snapshot: resolution.rulesSnapshot,
      updated_at: now,
    },
    { onConflict: 'quote_id,coupon_id' },
  )
  if (application.error) return false

  const quoteUpdate = await db
    .from('quotes')
    .update({
      discount: resolution.appliedDiscountAmount,
      discount_amount: resolution.appliedDiscountAmount,
      balance_due: args.breakdown.balance,
      total_amount: args.breakdown.total,
      quote_total: args.breakdown.total,
      pricing_breakdown: {
        ...args.breakdown,
        coupon: {
          code: resolution.coupon.code,
          campaign_name: resolution.coupon.campaign_name,
          approval_status: resolution.approvalStatus,
          potential_discount_amount: resolution.potentialDiscountAmount,
          applied_discount_amount: resolution.appliedDiscountAmount,
        },
      },
    })
    .eq('id', args.quoteId)
    .eq('company_id', args.companyId)
  if (quoteUpdate.error) return false

  const { data: versions, error: versionReadError } = await db
    .from('quote_versions')
    .select('id, commercial_snapshot')
    .eq('quote_id', args.quoteId)
    .eq('company_id', args.companyId)
    .eq('is_current', true)
  if (versionReadError) return false

  for (const row of versions ?? []) {
    const current =
      row.commercial_snapshot && typeof row.commercial_snapshot === 'object'
        ? { ...(row.commercial_snapshot as Record<string, unknown>) }
        : {}
    const update = await db
      .from('quote_versions')
      .update({
        discount_amount: resolution.appliedDiscountAmount,
        balance_due: args.breakdown.balance,
        quote_total: args.breakdown.total,
        commercial_snapshot: {
          ...current,
          pricing_breakdown: args.breakdown,
          coupon: {
            id: resolution.coupon.id,
            code: resolution.coupon.code,
            campaign_name: resolution.coupon.campaign_name,
            approval_status: resolution.approvalStatus,
            eligible_amount: resolution.eligibleAmount,
            potential_discount_amount: resolution.potentialDiscountAmount,
            applied_discount_amount: resolution.appliedDiscountAmount,
            rules_snapshot: resolution.rulesSnapshot,
          },
        },
      })
      .eq('id', row.id)
      .eq('company_id', args.companyId)
    if (update.error) return false
  }
  return true
}
