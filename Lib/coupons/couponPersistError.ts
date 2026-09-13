import { createHash } from 'node:crypto'

export type CouponReserveFailureReason =
  | 'usage_limit_reached'
  | 'new_customer_only'
  | 'persist_failed'

export type PersistQuoteCouponResult =
  | { ok: true }
  | { ok: false; reason: CouponReserveFailureReason }

export const COUPON_USAGE_CLAIM_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

function errorText(error: {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
} | null) {
  return [error?.message, error?.details, error?.hint, error?.code]
    .filter((part): part is string => Boolean(part))
    .join(' ')
}

export function classifyCouponReserveError(error: {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
} | null): CouponReserveFailureReason {
  const text = errorText(error)
  if (/coupon_usage_limit_reached/i.test(text)) return 'usage_limit_reached'
  if (/coupon_new_customer_only/i.test(text)) return 'new_customer_only'
  return 'persist_failed'
}

export function isMissingCouponReserveFunction(error: {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
} | null) {
  return /PGRST202|Could not find the function.*reserve_quote_coupon_application/i.test(
    errorText(error),
  )
}

export function isUniqueViolation(error: {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
} | null) {
  const text = errorText(error)
  return (
    error?.code === '23505' ||
    /duplicate key|unique constraint|uq_quote_coupon_once/i.test(text)
  )
}

export function uuidv5(namespaceUuid: string, name: string) {
  const ns = Buffer.from(namespaceUuid.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1').update(ns).update(name, 'utf8').digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function couponCustomerUsageClaimId(
  companyId: string,
  couponId: string,
  customerId: string,
  slot: number,
) {
  return uuidv5(
    COUPON_USAGE_CLAIM_NAMESPACE,
    `coupon-customer-use:${companyId}:${couponId}:${customerId}:${slot}`,
  )
}
