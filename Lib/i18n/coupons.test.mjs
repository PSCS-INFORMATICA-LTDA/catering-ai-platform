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
    assert.equal(tCoupons('pt', 'placeholder'), 'Digite seu código promocional')
    assert.equal(tCoupons('en', 'placeholder'), 'Enter promo code')
    assert.equal(tCoupons('es', 'placeholder'), 'Ingresa tu código promocional')
    assert.doesNotMatch(tCoupons('pt', 'placeholder'), /CDL10|WELCOME/i)
    assert.doesNotMatch(tCoupons('en', 'placeholder'), /CDL10|WELCOME/i)
    assert.doesNotMatch(tCoupons('es', 'placeholder'), /CDL10|WELCOME/i)
  })

  it('maps internal reasons to commercial copy without leaking postgres text', () => {
    assert.equal(tCouponReason('en', 'expired'), 'This coupon has expired.')
    assert.equal(tCouponReason('pt', 'not_found'), 'Cupom inválido ou indisponível.')
    assert.equal(tCouponReason('en', 'not_found'), 'Invalid or unavailable coupon.')
    assert.equal(tCouponReason('es', 'not_found'), 'Cupón inválido o no disponible.')
    assert.equal(tCouponReason('es', 'paused'), 'Este cupón está pausado.')
    assert.doesNotMatch(tCouponReason('en', 'uq_quote_coupon_once'), /uq_|postgres|stack/i)
  })
})
