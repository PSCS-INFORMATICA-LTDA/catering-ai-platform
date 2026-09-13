import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tCouponReason, tCoupons } from './coupons.ts'

describe('coupon i18n', () => {
  it('localizes public apply/remove/pending copy in PT EN ES', () => {
    assert.equal(tCoupons('pt', 'apply'), 'Aplicar')
    assert.equal(tCoupons('en', 'apply'), 'Apply')
    assert.equal(tCoupons('es', 'apply'), 'Aplicar')
    assert.match(tCoupons('en', 'receivedPending'), /pending approval/i)
    assert.match(tCoupons('pt', 'receivedPending'), /aguardando aprovação/i)
    assert.match(tCoupons('es', 'receivedPending'), /pendiente/i)
  })

  it('maps internal reasons to commercial copy without leaking postgres text', () => {
    assert.equal(tCouponReason('en', 'expired'), 'This coupon has expired.')
    assert.equal(tCouponReason('pt', 'not_found'), 'Cupom não encontrado.')
    assert.equal(tCouponReason('es', 'paused'), 'Este cupón está pausado.')
    assert.doesNotMatch(tCouponReason('en', 'uq_quote_coupon_once'), /uq_|postgres|stack/i)
  })
})
