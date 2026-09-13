import 'server-only'

import {
  applyCouponToBreakdown,
  buildCouponCommercialSnapshot,
  evaluateCouponForPricing,
  normalizeCouponCode,
  type CouponAllocation,
  type CouponCommercialSnapshot,
  type CouponEvaluation,
  type CouponRejectReason,
  type CouponRuleFields,
} from '@/Lib/coupons/couponMath'
import { normalizePhone } from '@/Lib/normalizePhone'
import {
  classifyCouponReserveError,
  couponCustomerUsageClaimId,
  isMissingCouponReserveFunction,
  isUniqueViolation,
  type PersistQuoteCouponResult,
} from '@/Lib/coupons/couponPersistError'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type { PersistQuoteCouponResult }

export type CouponRecord = CouponRuleFields
export type CouponResolution = CouponEvaluation
export type { CouponAllocation, CouponCommercialSnapshot, CouponRejectReason }
export { normalizeCouponCode, applyCouponToBreakdown, buildCouponCommercialSnapshot }

type ResolveCouponInput = {
  companyId: string
  code: string
  eventDate: string
  packageId: string
  breakdown: PricingBreakdown
  contactPhone?: string | null
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

async function catalogMap(companyId: string, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, { category_pt?: string | null }>()
  const { data } = await getSupabaseServerClient()
    .from('catalog_items')
    .select('id, category_pt')
    .eq('company_id', companyId)
    .in('id', itemIds)
  return new Map(
    (data ?? []).map((item) => [String(item.id), item as { category_pt?: string | null }]),
  )
}

async function customerCouponUsage(
  companyId: string,
  couponId: string,
  phoneValue?: string | null,
) {
  const phone = normalizePhone(phoneValue)
  if (!phone) return { phoneNormalized: false, customerExists: false, uses: 0 }
  const db = getSupabaseServerClient()
  const { data: customers } = await db
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone_normalized', phone)
  if (!customers?.length) {
    return { phoneNormalized: true, customerExists: false, uses: 0 }
  }
  const { data: quotes } = await db
    .from('quotes')
    .select('id')
    .eq('company_id', companyId)
    .in('customer_id', customers.map((customer) => customer.id))
  if (!quotes?.length) {
    return { phoneNormalized: true, customerExists: true, uses: 0 }
  }
  const { count } = await db
    .from('quote_coupon_applications')
    .select('id', { head: true, count: 'exact' })
    .eq('company_id', companyId)
    .eq('coupon_id', couponId)
    .in('quote_id', quotes.map((quote) => quote.id))
    .in('approval_status', ['pending', 'applied'])
  return {
    phoneNormalized: true,
    customerExists: true,
    uses: Number(count ?? 0),
  }
}

export async function quoteHasPendingCoupon(companyId: string, quoteId: string) {
  const { count, error } = await getSupabaseServerClient()
    .from('quote_coupon_applications')
    .select('id', { head: true, count: 'exact' })
    .eq('company_id', companyId)
    .eq('quote_id', quoteId)
    .eq('approval_status', 'pending')
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, pending: Number(count ?? 0) > 0 }
}

export async function resolveCouponForPricing(
  input: ResolveCouponInput,
): Promise<CouponResolution> {
  const code = normalizeCouponCode(input.code)
  const emptyCoupon = {
    id: '',
    company_id: input.companyId,
    code: '',
    campaign_name: '',
    description: null,
    status: 'draft' as const,
    discount_type: 'fixed' as const,
    discount_value: 0,
    max_discount_amount: null,
    min_eligible_amount: 0,
    valid_from: null,
    valid_to: null,
    eligible_weekdays: [0, 1, 2, 3, 4, 5, 6],
    all_packages: true,
    eligible_package_ids: [],
    include_additionals: true,
    include_grill: false,
    include_additional_cuts: false,
    include_mileage: false,
    new_customer_only: false,
    max_uses_per_customer: null,
    max_uses_per_quote: 1,
    stackable: false,
    apply_to_deposit: false,
    apply_to_balance: true,
    allow_post_event_adjustment: false,
    manual_approval_required: false,
    distribution_channel: null,
    minimum_final_mon_thu: null,
    minimum_final_fri_sun: null,
    metadata: {},
  }
  if (!code) {
    return {
      ...evaluateCouponForPricing({
        coupon: { ...emptyCoupon, status: 'archived' },
        nowDate: new Date().toISOString().slice(0, 10),
        eventDate: input.eventDate,
        packageId: input.packageId,
        breakdown: input.breakdown,
      }),
      reason: 'not_found',
    }
  }

  const { data, error } = await getSupabaseServerClient()
    .from('coupons')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('code', code)
    .maybeSingle()
  if (error || !data) {
    return {
      ...evaluateCouponForPricing({
        coupon: { ...emptyCoupon, status: 'archived' },
        nowDate: new Date().toISOString().slice(0, 10),
        eventDate: input.eventDate,
        packageId: input.packageId,
        breakdown: input.breakdown,
      }),
      reason: 'not_found',
    }
  }

  const coupon = record(data as Record<string, unknown>)
  const additionalIds = input.breakdown.lines
    .filter((line) => line.line_key === 'additional_item' && line.source_id)
    .map((line) => String(line.source_id))
  const [catalog, customerUsage] = await Promise.all([
    catalogMap(input.companyId, additionalIds),
    customerCouponUsage(input.companyId, coupon.id, input.contactPhone),
  ])

  return evaluateCouponForPricing({
    coupon,
    nowDate: new Date().toISOString().slice(0, 10),
    eventDate: input.eventDate,
    packageId: input.packageId,
    breakdown: input.breakdown,
    catalog,
    customerUsage,
  })
}

export function pricedBreakdownFromCoupon(
  breakdown: PricingBreakdown,
  resolution: CouponResolution,
): PricingBreakdown {
  return applyCouponToBreakdown(breakdown, resolution)
}

async function insertWithCustomerUsageClaim(input: {
  db: ReturnType<typeof getSupabaseServerClient>
  companyId: string
  quoteId: string
  couponId: string
  maxUsesPerCustomer: number | null
  maxUsesPerQuote: number
  payload: Record<string, unknown>
}): Promise<PersistQuoteCouponResult> {
  const existing = await input.db
    .from('quote_coupon_applications')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('quote_id', input.quoteId)
    .eq('coupon_id', input.couponId)
    .maybeSingle()
  if (existing.data?.id) return { ok: true }

  const quoteUses = await input.db
    .from('quote_coupon_applications')
    .select('id', { head: true, count: 'exact' })
    .eq('company_id', input.companyId)
    .eq('quote_id', input.quoteId)
    .in('approval_status', ['pending', 'applied'])
  if (Number(quoteUses.count ?? 0) >= input.maxUsesPerQuote) {
    return { ok: false, reason: 'usage_limit_reached' }
  }

  const quote = await input.db
    .from('quotes')
    .select('customer_id')
    .eq('id', input.quoteId)
    .eq('company_id', input.companyId)
    .maybeSingle()
  const customerId =
    typeof quote.data?.customer_id === 'string' ? quote.data.customer_id : null

  if (!customerId || input.maxUsesPerCustomer == null) {
    const inserted = await input.db.from('quote_coupon_applications').insert(input.payload)
    if (!inserted.error) return { ok: true }
    if (isUniqueViolation(inserted.error)) {
      const sameQuote = await input.db
        .from('quote_coupon_applications')
        .select('id')
        .eq('company_id', input.companyId)
        .eq('quote_id', input.quoteId)
        .eq('coupon_id', input.couponId)
        .maybeSingle()
      if (sameQuote.data?.id) return { ok: true }
    }
    return { ok: false, reason: classifyCouponReserveError(inserted.error) }
  }

  const customerQuotes = await input.db
    .from('quotes')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('customer_id', customerId)
  const quoteIds = (customerQuotes.data ?? []).map((row) => String(row.id))
  const uses = quoteIds.length
    ? await input.db
        .from('quote_coupon_applications')
        .select('id', { head: true, count: 'exact' })
        .eq('company_id', input.companyId)
        .eq('coupon_id', input.couponId)
        .in('quote_id', quoteIds)
        .in('approval_status', ['pending', 'applied'])
    : { count: 0 }
  const liveUses = Number(uses.count ?? 0)
  if (liveUses >= input.maxUsesPerCustomer) {
    return { ok: false, reason: 'usage_limit_reached' }
  }

  for (let slot = liveUses + 1; slot <= input.maxUsesPerCustomer; slot += 1) {
    const claimId = couponCustomerUsageClaimId(
      input.companyId,
      input.couponId,
      customerId,
      slot,
    )
    const inserted = await input.db.from('quote_coupon_applications').insert({
      ...input.payload,
      id: claimId,
    })
    if (!inserted.error) return { ok: true }
    if (!isUniqueViolation(inserted.error)) {
      return { ok: false, reason: classifyCouponReserveError(inserted.error) }
    }
    const sameQuote = await input.db
      .from('quote_coupon_applications')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('quote_id', input.quoteId)
      .eq('coupon_id', input.couponId)
      .maybeSingle()
    if (sameQuote.data?.id) return { ok: true }
  }
  return { ok: false, reason: 'usage_limit_reached' }
}

export async function persistQuoteCouponApplication(args: {
  companyId: string
  quoteId: string
  resolution: CouponResolution
  breakdown: PricingBreakdown
}): Promise<PersistQuoteCouponResult> {
  const { resolution } = args
  if (!resolution.valid || !resolution.coupon) return { ok: true }
  const db = getSupabaseServerClient()
  const now = new Date().toISOString()
  const snapshot = buildCouponCommercialSnapshot(resolution, {
    appliedAt: resolution.approvalStatus === 'applied' ? now : null,
  })
  const priced = args.breakdown.coupon
    ? args.breakdown
    : applyCouponToBreakdown(args.breakdown, resolution)
  const rulesSnapshot = {
    ...resolution.rulesSnapshot,
    allocation: resolution.allocation,
    projected_allocation: resolution.projectedAllocation,
    commercial_snapshot: snapshot,
  }
  const payload = {
    company_id: args.companyId,
    quote_id: args.quoteId,
    coupon_id: resolution.coupon.id,
    coupon_code_snapshot: resolution.coupon.code,
    campaign_name_snapshot: resolution.coupon.campaign_name,
    eligible_amount: resolution.eligibleAmount,
    potential_discount_amount: resolution.potentialDiscountAmount,
    applied_discount_amount: resolution.appliedDiscountAmount,
    approval_status: resolution.approvalStatus,
    rules_snapshot: rulesSnapshot,
    updated_at: now,
  }
  const reserved = await db.rpc('reserve_quote_coupon_application', {
    p_company_id: args.companyId,
    p_quote_id: args.quoteId,
    p_coupon_id: resolution.coupon.id,
    p_payload: {
      coupon_code_snapshot: payload.coupon_code_snapshot,
      campaign_name_snapshot: payload.campaign_name_snapshot,
      eligible_amount: payload.eligible_amount,
      potential_discount_amount: payload.potential_discount_amount,
      applied_discount_amount: payload.applied_discount_amount,
      approval_status: payload.approval_status,
      rules_snapshot: rulesSnapshot,
    },
  })
  if (reserved.error && !isMissingCouponReserveFunction(reserved.error)) {
    return { ok: false, reason: classifyCouponReserveError(reserved.error) }
  }
  if (reserved.error) {
    const claimed = await insertWithCustomerUsageClaim({
      db,
      companyId: args.companyId,
      quoteId: args.quoteId,
      couponId: resolution.coupon.id,
      maxUsesPerCustomer: resolution.coupon.max_uses_per_customer,
      maxUsesPerQuote: resolution.coupon.max_uses_per_quote,
      payload,
    })
    if (!claimed.ok) return claimed
  }

  const { error: quoteError } = await db
    .from('quotes')
    .update({
      discount: resolution.appliedDiscountAmount,
      discount_amount: resolution.appliedDiscountAmount,
      reservation_amount: priced.deposit,
      deposit_amount: priced.deposit,
      balance_due: priced.balance,
      total_amount: priced.total,
      quote_total: priced.total,
      pricing_breakdown: priced,
    })
    .eq('id', args.quoteId)
    .eq('company_id', args.companyId)
  if (quoteError) return { ok: false, reason: 'persist_failed' }

  const { data: versions, error: versionReadError } = await db
    .from('quote_versions')
    .select('id, commercial_snapshot')
    .eq('quote_id', args.quoteId)
    .eq('company_id', args.companyId)
    .eq('is_current', true)
  if (versionReadError) return { ok: false, reason: 'persist_failed' }
  for (const version of versions ?? []) {
    const current =
      version.commercial_snapshot && typeof version.commercial_snapshot === 'object'
        ? { ...(version.commercial_snapshot as Record<string, unknown>) }
        : {}
    const { error } = await db
      .from('quote_versions')
      .update({
        discount_amount: resolution.appliedDiscountAmount,
        reservation_amount: priced.deposit,
        balance_due: priced.balance,
        quote_total: priced.total,
        commercial_snapshot: {
          ...current,
          pricing_breakdown: priced,
          coupon: snapshot,
        },
      })
      .eq('id', version.id)
      .eq('company_id', args.companyId)
    if (error) return { ok: false, reason: 'persist_failed' }
  }
  return { ok: true }
}
