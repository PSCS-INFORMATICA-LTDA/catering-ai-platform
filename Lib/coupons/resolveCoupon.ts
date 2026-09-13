import 'server-only'

import { normalizePhone } from '@/Lib/normalizePhone'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type CouponRecord = {
  id: string
  company_id: string
  code: string
  campaign_name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  discount_type: 'fixed' | 'percent'
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

type CatalogShape = {
  id: string
  category_pt?: string | null
}

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function record(row: Record<string, unknown>): CouponRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    code: String(row.code),
    campaign_name: String(row.campaign_name),
    description: typeof row.description === 'string' ? row.description : null,
    status: row.status as CouponRecord['status'],
    discount_type: row.discount_type as CouponRecord['discount_type'],
    discount_value: num(row.discount_value),
    max_discount_amount:
      row.max_discount_amount == null ? null : num(row.max_discount_amount),
    min_eligible_amount: num(row.min_eligible_amount),
    valid_from: typeof row.valid_from === 'string' ? row.valid_from : null,
    valid_to: typeof row.valid_to === 'string' ? row.valid_to : null,
    eligible_weekdays: Array.isArray(row.eligible_weekdays)
      ? row.eligible_weekdays.map(Number).filter(Number.isFinite)
      : [0, 1, 2, 3, 4, 5, 6],
    all_packages: row.all_packages !== false,
    eligible_package_ids: Array.isArray(row.eligible_package_ids)
      ? row.eligible_package_ids.map(String)
      : [],
    include_additionals: row.include_additionals !== false,
    include_grill: row.include_grill === true,
    include_additional_cuts: row.include_additional_cuts === true,
    include_mileage: row.include_mileage === true,
    new_customer_only: row.new_customer_only === true,
    max_uses_per_customer:
      row.max_uses_per_customer == null ? null : num(row.max_uses_per_customer),
    max_uses_per_quote: Math.max(1, num(row.max_uses_per_quote, 1)),
    stackable: row.stackable === true,
    apply_to_deposit: row.apply_to_deposit === true,
    apply_to_balance: row.apply_to_balance !== false,
    allow_post_event_adjustment: row.allow_post_event_adjustment === true,
    manual_approval_required: row.manual_approval_required === true,
    distribution_channel:
      typeof row.distribution_channel === 'string' ? row.distribution_channel : null,
    minimum_final_mon_thu:
      row.minimum_final_mon_thu == null ? null : num(row.minimum_final_mon_thu),
    minimum_final_fri_sun:
      row.minimum_final_fri_sun == null ? null : num(row.minimum_final_fri_sun),
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

function ruleSnapshot(coupon: CouponRecord) {
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

function invalid(
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
    manualApprovalRequired: Boolean(coupon?.manual_approval_required),
    approvalStatus: coupon?.manual_approval_required ? 'pending' : 'applied',
    minimumFinalAmount: null,
    totalBeforeCoupon: money(total),
    totalAfterCoupon: money(total),
    projectedTotalAfterApproval: money(total),
    rulesSnapshot: coupon ? ruleSnapshot(coupon) : {},
  }
}

function weekday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function isCut(item: CatalogShape | undefined) {
  const category = (item?.category_pt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return ['bovino', 'cordeiro', 'frango', 'frutos do mar', 'linguica', 'porco', 'suino'].some(
    (key) => category.includes(key),
  )
}

async function catalogMap(companyId: string, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, CatalogShape>()
  const { data } = await getSupabaseServerClient()
    .from('catalog_items')
    .select('id, category_pt')
    .eq('company_id', companyId)
    .in('id', itemIds)
  return new Map<string, CatalogShape>(
    (data ?? []).map((item) => [String(item.id), item as CatalogShape]),
  )
}

async function customerCouponUsage(
  companyId: string,
  couponId: string,
  phoneValue?: string | null,
) {
  const phone = normalizePhone(phoneValue)
  if (!phone) return { exists: false, uses: 0 }
  const db = getSupabaseServerClient()
  const { data: customers } = await db
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone_normalized', phone)
  if (!customers?.length) return { exists: false, uses: 0 }
  const { data: quotes } = await db
    .from('quotes')
    .select('id')
    .eq('company_id', companyId)
    .in('customer_id', customers.map((customer) => customer.id))
  if (!quotes?.length) return { exists: true, uses: 0 }
  const { count } = await db
    .from('quote_coupon_applications')
    .select('id', { head: true, count: 'exact' })
    .eq('company_id', companyId)
    .eq('coupon_id', couponId)
    .in('quote_id', quotes.map((quote) => quote.id))
    .in('approval_status', ['pending', 'applied'])
  return { exists: true, uses: Number(count ?? 0) }
}

export function normalizeCouponCode(value: unknown) {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) ? code : null
}

export async function resolveCouponForPricing(
  input: ResolveCouponInput,
): Promise<CouponResolution> {
  const total = money(input.breakdown.total)
  const code = normalizeCouponCode(input.code)
  if (!code) return invalid('not_found', total)

  const { data, error } = await getSupabaseServerClient()
    .from('coupons')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return invalid('not_found', total)
  const coupon = record(data as Record<string, unknown>)

  if (coupon.status !== 'active') return invalid('inactive', total, coupon)
  // V1 intentionally protects the reservation deposit. Coupons reduce balance only.
  if (coupon.apply_to_deposit || !coupon.apply_to_balance) {
    return invalid('invalid_configuration', total, coupon)
  }

  const redeemedAt = today()
  if (coupon.valid_from && redeemedAt < coupon.valid_from) {
    return invalid('not_started', total, coupon)
  }
  if (coupon.valid_to && redeemedAt > coupon.valid_to) {
    return invalid('expired', total, coupon)
  }

  const eventWeekday = weekday(input.eventDate)
  if (eventWeekday == null || !coupon.eligible_weekdays.includes(eventWeekday)) {
    return invalid('weekday_not_allowed', total, coupon)
  }
  if (!coupon.all_packages && !coupon.eligible_package_ids.includes(input.packageId)) {
    return invalid('package_not_allowed', total, coupon)
  }

  const usage = await customerCouponUsage(
    input.companyId,
    coupon.id,
    input.contactPhone,
  )
  if (coupon.new_customer_only && usage.exists) {
    return invalid('customer_not_eligible', total, coupon)
  }
  if (
    coupon.max_uses_per_customer != null &&
    usage.uses >= coupon.max_uses_per_customer
  ) {
    return invalid('usage_limit_reached', total, coupon)
  }

  const additionalIds = input.breakdown.lines
    .filter((line) => line.line_key === 'additional_item' && line.source_id)
    .map((line) => String(line.source_id))
  const catalog = await catalogMap(input.companyId, additionalIds)

  let eligibleAmount = 0
  for (const line of input.breakdown.lines) {
    const amount = Math.max(0, num(line.amount))
    if (line.line_key === 'package' || line.line_key === 'package_sides') {
      eligibleAmount += amount
    } else if (line.line_key === 'additional_item' && coupon.include_additionals) {
      if (
        coupon.include_additional_cuts ||
        !isCut(line.source_id ? catalog.get(String(line.source_id)) : undefined)
      ) {
        eligibleAmount += amount
      }
    } else if (line.line_key === 'grill_rental' && coupon.include_grill) {
      eligibleAmount += amount
    } else if (line.line_key === 'mileage' && coupon.include_mileage) {
      eligibleAmount += amount
    }
  }
  eligibleAmount = money(eligibleAmount)
  if (eligibleAmount <= 0) return invalid('nothing_eligible', total, coupon)
  if (eligibleAmount < coupon.min_eligible_amount) {
    return { ...invalid('minimum_not_reached', total, coupon), eligibleAmount }
  }

  let potential =
    coupon.discount_type === 'percent'
      ? eligibleAmount * (coupon.discount_value / 100)
      : coupon.discount_value
  if (coupon.max_discount_amount != null) {
    potential = Math.min(potential, coupon.max_discount_amount)
  }
  potential = Math.min(potential, eligibleAmount, total)

  const monThu = eventWeekday >= 1 && eventWeekday <= 4
  const minimumFinalAmount = monThu
    ? coupon.minimum_final_mon_thu
    : coupon.minimum_final_fri_sun
  if (minimumFinalAmount != null) {
    potential = Math.min(potential, Math.max(0, total - minimumFinalAmount))
  }
  potential = money(Math.max(0, potential))
  if (potential <= 0) {
    return {
      ...invalid('minimum_not_reached', total, coupon),
      eligibleAmount,
      minimumFinalAmount,
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
    totalAfterCoupon: money(total - applied),
    projectedTotalAfterApproval: money(total - potential),
    rulesSnapshot: ruleSnapshot(coupon),
  }
}

export async function persistQuoteCouponApplication(args: {
  companyId: string
  quoteId: string
  resolution: CouponResolution
  breakdown: PricingBreakdown
}) {
  const { resolution } = args
  if (!resolution.valid || !resolution.coupon) return true
  const db = getSupabaseServerClient()
  const now = new Date().toISOString()
  const { error: applicationError } = await db
    .from('quote_coupon_applications')
    .upsert(
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
  if (applicationError) return false

  const couponSnapshot = {
    id: resolution.coupon.id,
    code: resolution.coupon.code,
    campaign_name: resolution.coupon.campaign_name,
    approval_status: resolution.approvalStatus,
    eligible_amount: resolution.eligibleAmount,
    potential_discount_amount: resolution.potentialDiscountAmount,
    applied_discount_amount: resolution.appliedDiscountAmount,
    rules_snapshot: resolution.rulesSnapshot,
  }

  const { error: quoteError } = await db
    .from('quotes')
    .update({
      discount: resolution.appliedDiscountAmount,
      discount_amount: resolution.appliedDiscountAmount,
      balance_due: args.breakdown.balance,
      total_amount: args.breakdown.total,
      quote_total: args.breakdown.total,
      pricing_breakdown: { ...args.breakdown, coupon: couponSnapshot },
    })
    .eq('id', args.quoteId)
    .eq('company_id', args.companyId)
  if (quoteError) return false

  const { data: versions, error: versionReadError } = await db
    .from('quote_versions')
    .select('id, commercial_snapshot')
    .eq('quote_id', args.quoteId)
    .eq('company_id', args.companyId)
    .eq('is_current', true)
  if (versionReadError) return false
  for (const version of versions ?? []) {
    const current =
      version.commercial_snapshot && typeof version.commercial_snapshot === 'object'
        ? { ...(version.commercial_snapshot as Record<string, unknown>) }
        : {}
    const { error } = await db
      .from('quote_versions')
      .update({
        discount_amount: resolution.appliedDiscountAmount,
        balance_due: args.breakdown.balance,
        quote_total: args.breakdown.total,
        commercial_snapshot: {
          ...current,
          pricing_breakdown: args.breakdown,
          coupon: couponSnapshot,
        },
      })
      .eq('id', version.id)
      .eq('company_id', args.companyId)
    if (error) return false
  }
  return true
}
