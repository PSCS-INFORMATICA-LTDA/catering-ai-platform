export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/
export const COUPON_CURRENCY = 'USD'

export type CouponDiscountType = 'fixed' | 'percent'
export type CouponStatus = 'draft' | 'active' | 'paused' | 'archived'

export type CouponRuleFields = {
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
  | 'paused'
  | 'not_started'
  | 'expired'
  | 'weekday_not_allowed'
  | 'package_not_allowed'
  | 'minimum_not_reached'
  | 'customer_not_eligible'
  | 'usage_limit_reached'
  | 'nothing_eligible'
  | 'invalid_configuration'

export type CouponApprovalStatus = 'pending' | 'applied'

export type CouponAllocation = {
  applyToDeposit: boolean
  applyToBalance: boolean
  fromDeposit: number
  fromBalance: number
  depositDue: number
  balanceDue: number
  finalTotal: number
  authorizedDiscount: number
}

export type CouponLine = {
  line_key: string
  amount?: number | null
  source_id?: string | null
}

export type CouponBreakdownLike = {
  lines?: CouponLine[]
  adjustments?: Array<Record<string, unknown>>
  total: number
  deposit: number
  balance: number
  subtotal?: number
  coupon?: CouponCommercialSnapshot | Record<string, unknown> | null
}

export type CouponCustomerUsage = {
  phoneNormalized: boolean
  customerExists: boolean
  uses: number
}

export type CouponCommercialSnapshot = {
  id: string
  code: string
  campaign_name: string
  discount_type: CouponDiscountType
  discount_value: number
  approval_status: CouponApprovalStatus
  eligible_amount: number
  potential_discount_amount: number
  applied_discount_amount: number
  deposit_discount_amount: number
  balance_discount_amount: number
  apply_to_deposit: boolean
  apply_to_balance: boolean
  currency: string
  manual_approval_required: boolean
  approved_at?: string | null
  applied_at?: string | null
  rules_snapshot: Record<string, unknown>
}

export type CouponEvaluation = {
  valid: boolean
  reason?: CouponRejectReason
  coupon?: CouponRuleFields
  eligibleAmount: number
  potentialDiscountAmount: number
  appliedDiscountAmount: number
  manualApprovalRequired: boolean
  approvalStatus: CouponApprovalStatus
  minimumFinalAmount: number | null
  totalBeforeCoupon: number
  totalAfterCoupon: number
  projectedTotalAfterApproval: number
  allocation: CouponAllocation
  projectedAllocation: CouponAllocation
  rulesSnapshot: Record<string, unknown>
}

export function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function normalizeCouponCode(value: unknown) {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return COUPON_CODE_PATTERN.test(code) ? code : null
}

export function couponRuleSnapshot(coupon: CouponRuleFields) {
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

export function emptyAllocation(total: number, deposit: number): CouponAllocation {
  const safeTotal = money(Math.max(0, total))
  const safeDeposit = money(Math.min(Math.max(0, deposit), safeTotal))
  return {
    applyToDeposit: false,
    applyToBalance: true,
    fromDeposit: 0,
    fromBalance: 0,
    depositDue: safeDeposit,
    balanceDue: money(safeTotal - safeDeposit),
    finalTotal: safeTotal,
    authorizedDiscount: 0,
  }
}

export function assertFinancialInvariant(input: {
  discount: number
  eligibleSubtotal: number
  finalTotal: number
  canonicalTotal: number
  depositDue: number
  balanceDue: number
}) {
  const discount = money(input.discount)
  const eligible = money(input.eligibleSubtotal)
  const finalTotal = money(input.finalTotal)
  const canonical = money(input.canonicalTotal)
  const depositDue = money(input.depositDue)
  const balanceDue = money(input.balanceDue)
  return (
    discount >= 0 &&
    discount <= eligible + 0.0001 &&
    finalTotal >= 0 &&
    Math.abs(finalTotal - money(canonical - discount)) <= 0.0001 &&
    depositDue >= 0 &&
    balanceDue >= 0 &&
    Math.abs(money(depositDue + balanceDue) - finalTotal) <= 0.0001
  )
}

/**
 * Deposit is protected unless apply_to_deposit is true.
 * Balance is used first when both flags are true so the reservation
 * stays intact until the leftover discount needs the deposit bucket.
 */
export function allocateCouponDiscount(input: {
  total: number
  deposit: number
  authorizedDiscount: number
  applyToDeposit: boolean
  applyToBalance: boolean
}): CouponAllocation | { error: 'invalid_configuration' } {
  if (!input.applyToDeposit && !input.applyToBalance) {
    return { error: 'invalid_configuration' }
  }
  const total = money(Math.max(0, input.total))
  const deposit = money(Math.min(Math.max(0, input.deposit), total))
  const balance = money(total - deposit)
  let remaining = money(Math.max(0, input.authorizedDiscount))
  let fromBalance = 0
  let fromDeposit = 0
  if (input.applyToBalance) {
    fromBalance = money(Math.min(remaining, balance))
    remaining = money(remaining - fromBalance)
  }
  if (input.applyToDeposit) {
    fromDeposit = money(Math.min(remaining, deposit))
    remaining = money(remaining - fromDeposit)
  }
  const authorizedDiscount = money(fromBalance + fromDeposit)
  const depositDue = money(deposit - fromDeposit)
  const balanceDue = money(balance - fromBalance)
  const finalTotal = money(total - authorizedDiscount)
  return {
    applyToDeposit: input.applyToDeposit,
    applyToBalance: input.applyToBalance,
    fromDeposit,
    fromBalance,
    depositDue,
    balanceDue,
    finalTotal,
    authorizedDiscount,
  }
}

export function isAdditionalCut(category: string | null | undefined) {
  const normalized = (category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return [
    'bovino',
    'cordeiro',
    'frango',
    'frutos do mar',
    'linguica',
    'porco',
    'suino',
  ].some((key) => normalized.includes(key))
}

export function eligibleAmountFromBreakdown(
  coupon: Pick<
    CouponRuleFields,
    | 'include_additionals'
    | 'include_additional_cuts'
    | 'include_grill'
    | 'include_mileage'
  >,
  lines: CouponLine[],
  catalog: Map<string, { category_pt?: string | null }>,
) {
  let eligibleAmount = 0
  for (const line of lines) {
    const amount = Math.max(0, Number(line.amount) || 0)
    if (line.line_key === 'package' || line.line_key === 'package_sides') {
      eligibleAmount += amount
    } else if (line.line_key === 'additional_item' && coupon.include_additionals) {
      const item = line.source_id ? catalog.get(String(line.source_id)) : undefined
      if (coupon.include_additional_cuts || !isAdditionalCut(item?.category_pt)) {
        eligibleAmount += amount
      }
    } else if (line.line_key === 'grill_rental' && coupon.include_grill) {
      eligibleAmount += amount
    } else if (line.line_key === 'mileage' && coupon.include_mileage) {
      eligibleAmount += amount
    }
  }
  return money(eligibleAmount)
}

export function eventWeekdayUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay()
}

function rejected(
  reason: CouponRejectReason,
  total: number,
  deposit: number,
  coupon?: CouponRuleFields,
  extra?: Partial<CouponEvaluation>,
): CouponEvaluation {
  const allocation = emptyAllocation(total, deposit)
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
    allocation,
    projectedAllocation: allocation,
    rulesSnapshot: coupon ? couponRuleSnapshot(coupon) : {},
    ...extra,
  }
}

export function evaluateCouponForPricing(input: {
  coupon: CouponRuleFields
  nowDate: string
  eventDate: string
  packageId: string
  breakdown: CouponBreakdownLike
  catalog?: Map<string, { category_pt?: string | null }>
  customerUsage?: CouponCustomerUsage
}): CouponEvaluation {
  const total = money(Math.max(0, Number(input.breakdown.total) || 0))
  const deposit = money(Math.max(0, Number(input.breakdown.deposit) || 0))
  const coupon = input.coupon

  if (coupon.status === 'paused') return rejected('paused', total, deposit, coupon)
  if (coupon.status !== 'active') return rejected('inactive', total, deposit, coupon)
  if (!coupon.apply_to_deposit && !coupon.apply_to_balance) {
    return rejected('invalid_configuration', total, deposit, coupon)
  }
  if (coupon.valid_from && input.nowDate < coupon.valid_from) {
    return rejected('not_started', total, deposit, coupon)
  }
  if (coupon.valid_to && input.nowDate > coupon.valid_to) {
    return rejected('expired', total, deposit, coupon)
  }

  const weekday = eventWeekdayUtc(input.eventDate)
  if (weekday == null || !coupon.eligible_weekdays.includes(weekday)) {
    return rejected('weekday_not_allowed', total, deposit, coupon)
  }
  if (!coupon.all_packages && !coupon.eligible_package_ids.includes(input.packageId)) {
    return rejected('package_not_allowed', total, deposit, coupon)
  }

  const usage = input.customerUsage ?? {
    phoneNormalized: false,
    customerExists: false,
    uses: 0,
  }
  if (coupon.new_customer_only && (!usage.phoneNormalized || usage.customerExists)) {
    return rejected('customer_not_eligible', total, deposit, coupon)
  }
  if (
    coupon.max_uses_per_customer != null &&
    usage.uses >= coupon.max_uses_per_customer
  ) {
    return rejected('usage_limit_reached', total, deposit, coupon)
  }

  const eligibleAmount = eligibleAmountFromBreakdown(
    coupon,
    input.breakdown.lines ?? [],
    input.catalog ?? new Map(),
  )
  if (eligibleAmount <= 0) return rejected('nothing_eligible', total, deposit, coupon)
  if (eligibleAmount < coupon.min_eligible_amount) {
    return rejected('minimum_not_reached', total, deposit, coupon, { eligibleAmount })
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
  potential = money(Math.max(0, potential))

  const projected = allocateCouponDiscount({
    total,
    deposit,
    authorizedDiscount: potential,
    applyToDeposit: coupon.apply_to_deposit,
    applyToBalance: coupon.apply_to_balance,
  })
  if ('error' in projected || projected.authorizedDiscount <= 0) {
    return rejected('minimum_not_reached', total, deposit, coupon, {
      eligibleAmount,
      minimumFinalAmount,
    })
  }

  const appliedAmount = coupon.manual_approval_required
    ? 0
    : projected.authorizedDiscount
  const applied = coupon.manual_approval_required
    ? emptyAllocation(total, deposit)
    : projected
  applied.applyToDeposit = coupon.apply_to_deposit
  applied.applyToBalance = coupon.apply_to_balance

  return {
    valid: true,
    coupon,
    eligibleAmount,
    potentialDiscountAmount: projected.authorizedDiscount,
    appliedDiscountAmount: appliedAmount,
    manualApprovalRequired: coupon.manual_approval_required,
    approvalStatus: coupon.manual_approval_required ? 'pending' : 'applied',
    minimumFinalAmount,
    totalBeforeCoupon: total,
    totalAfterCoupon: applied.finalTotal,
    projectedTotalAfterApproval: projected.finalTotal,
    allocation: applied,
    projectedAllocation: projected,
    rulesSnapshot: couponRuleSnapshot(coupon),
  }
}

export function buildCouponCommercialSnapshot(
  evaluation: CouponEvaluation,
  extras: { approvedAt?: string | null; appliedAt?: string | null } = {},
): CouponCommercialSnapshot | null {
  if (!evaluation.coupon) return null
  const allocation = evaluation.valid
    ? evaluation.approvalStatus === 'pending'
      ? evaluation.projectedAllocation
      : evaluation.allocation
    : evaluation.allocation
  return {
    id: evaluation.coupon.id,
    code: evaluation.coupon.code,
    campaign_name: evaluation.coupon.campaign_name,
    discount_type: evaluation.coupon.discount_type,
    discount_value: evaluation.coupon.discount_value,
    approval_status: evaluation.approvalStatus,
    eligible_amount: evaluation.eligibleAmount,
    potential_discount_amount: evaluation.potentialDiscountAmount,
    applied_discount_amount: evaluation.appliedDiscountAmount,
    deposit_discount_amount: allocation.fromDeposit,
    balance_discount_amount: allocation.fromBalance,
    apply_to_deposit: allocation.applyToDeposit,
    apply_to_balance: allocation.applyToBalance,
    currency: COUPON_CURRENCY,
    manual_approval_required: evaluation.manualApprovalRequired,
    approved_at: extras.approvedAt ?? null,
    applied_at: extras.appliedAt ?? null,
    rules_snapshot: evaluation.rulesSnapshot,
  }
}

export function applyCouponToBreakdown<T extends CouponBreakdownLike>(
  breakdown: T,
  evaluation: CouponEvaluation,
): T & { coupon: CouponCommercialSnapshot | null } {
  const snapshot = evaluation.valid ? buildCouponCommercialSnapshot(evaluation) : null
  const allocation =
    evaluation.valid && evaluation.appliedDiscountAmount > 0
      ? evaluation.allocation
      : emptyAllocation(breakdown.total, breakdown.deposit)
  const adjustments = Array.isArray(breakdown.adjustments)
    ? breakdown.adjustments.filter((line) => line.line_key !== 'discount')
    : []
  if (evaluation.appliedDiscountAmount > 0) {
    adjustments.push({
      line_key: 'discount',
      source_type: 'discount',
      source_id: evaluation.coupon?.id ?? null,
      description: evaluation.coupon
        ? `Cupom ${evaluation.coupon.code}`
        : 'Desconto',
      quantity: 1,
      unit: 'adjustment',
      unit_price: -evaluation.appliedDiscountAmount,
      amount: -evaluation.appliedDiscountAmount,
      metadata: {
        campaign_name: evaluation.coupon?.campaign_name ?? null,
        coupon_code: evaluation.coupon?.code ?? null,
        apply_to_deposit: allocation.applyToDeposit,
        apply_to_balance: allocation.applyToBalance,
      },
    })
  }
  return {
    ...breakdown,
    adjustments,
    total: allocation.finalTotal,
    deposit: allocation.depositDue,
    balance: allocation.balanceDue,
    coupon: snapshot,
  }
}

export function allocateApprovedCoupon(input: {
  total: number
  deposit: number
  authorizedDiscount: number
  applyToDeposit: boolean
  applyToBalance: boolean
}) {
  const allocation = allocateCouponDiscount(input)
  if ('error' in allocation) return allocation
  if (
    !assertFinancialInvariant({
      discount: allocation.authorizedDiscount,
      eligibleSubtotal: Math.max(allocation.authorizedDiscount, input.authorizedDiscount),
      finalTotal: allocation.finalTotal,
      canonicalTotal: money(input.total),
      depositDue: allocation.depositDue,
      balanceDue: allocation.balanceDue,
    })
  ) {
    return { error: 'invalid_configuration' as const }
  }
  return allocation
}
