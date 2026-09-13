import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyCouponReserveError,
  couponCustomerUsageClaimId,
  isMissingCouponReserveFunction,
  isUniqueViolation,
} from './couponPersistError.ts'

describe('classifyCouponReserveError', () => {
  it('maps the atomic usage-limit exception', () => {
    assert.equal(
      classifyCouponReserveError({
        message: 'coupon_usage_limit_reached',
        code: 'P0001',
      }),
      'usage_limit_reached',
    )
  })

  it('maps new-customer-only after the coupon lock', () => {
    assert.equal(
      classifyCouponReserveError({
        details: 'coupon_new_customer_only',
      }),
      'new_customer_only',
    )
  })

  it('fails closed on unknown reserve errors', () => {
    assert.equal(classifyCouponReserveError(null), 'persist_failed')
    assert.equal(
      classifyCouponReserveError({ message: 'permission denied' }),
      'persist_failed',
    )
  })

  it('detects a missing reserve RPC', () => {
    assert.equal(
      isMissingCouponReserveFunction({
        code: 'PGRST202',
        message: 'Could not find the function public.reserve_quote_coupon_application',
      }),
      true,
    )
    assert.equal(isMissingCouponReserveFunction({ message: 'coupon_usage_limit_reached' }), false)
  })

  it('detects unique violations', () => {
    assert.equal(isUniqueViolation({ code: '23505' }), true)
    assert.equal(isUniqueViolation({ message: 'duplicate key value violates unique constraint' }), true)
  })

  it('builds a stable customer usage claim id', () => {
    const left = couponCustomerUsageClaimId('c1', 'coupon-1', 'cust-1', 1)
    const right = couponCustomerUsageClaimId('c1', 'coupon-1', 'cust-1', 1)
    const other = couponCustomerUsageClaimId('c1', 'coupon-1', 'cust-1', 2)
    assert.equal(left, right)
    assert.notEqual(left, other)
    assert.match(left, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
