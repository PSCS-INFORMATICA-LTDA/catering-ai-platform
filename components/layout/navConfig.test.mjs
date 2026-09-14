import assert from 'node:assert/strict'
import test from 'node:test'
import { canSeeNavChild } from './navConfig.ts'

const financeChild = {
  href: '/finance',
  label: 'Visão Geral',
  requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
}

test('hydrating session does not hide implemented finance routes', () => {
  assert.equal(canSeeNavChild(null, financeChild), true)
})

test('loaded session without finance permission hides finance', () => {
  assert.equal(
    canSeeNavChild({ isPlatformAdmin: false, permissions: ['quotes.view'] }, financeChild),
    false,
  )
})

test('loaded session with finance permission sees finance', () => {
  assert.equal(
    canSeeNavChild(
      { isPlatformAdmin: false, permissions: ['finance.invoices.view'] },
      financeChild,
    ),
    true,
  )
})

test('platform admin sees permission-gated routes', () => {
  assert.equal(canSeeNavChild({ isPlatformAdmin: true, permissions: [] }, financeChild), true)
})

test('routes without permission stay visible', () => {
  assert.equal(
    canSeeNavChild(null, { href: '/quotes', label: 'Cotações' }),
    true,
  )
  assert.equal(
    canSeeNavChild({ isPlatformAdmin: false, permissions: [] }, { href: '/quotes', label: 'Cotações' }),
    true,
  )
})

const couponChild = {
  href: '/coupons',
  label: 'Cupons',
  requiredPermission: 'commercial.coupons.view',
}

test('hydrating session does not hide coupon center', () => {
  assert.equal(canSeeNavChild(null, couponChild), true)
})

test('loaded session without coupon permission hides coupon center', () => {
  assert.equal(
    canSeeNavChild({ isPlatformAdmin: false, permissions: ['quotes.view'] }, couponChild),
    false,
  )
})
