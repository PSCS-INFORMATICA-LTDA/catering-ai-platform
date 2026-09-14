import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tPublicOps } from './publicOps.ts'
import { tPayments } from './payments.ts'

describe('final payment flow i18n', () => {
  it('T56-T58 localizes public payment choices in PT EN ES', () => {
    assert.equal(tPublicOps('pt', 'paymentTitle'), 'Pagamento')
    assert.equal(tPublicOps('en', 'paymentTitle'), 'Payment')
    assert.equal(tPublicOps('es', 'paymentTitle'), 'Pago')
    assert.match(tPublicOps('pt', 'payDepositChoice', { amount: 'US$ 846.00' }), /Pagar sinal/)
    assert.match(tPublicOps('en', 'payBalanceChoice', { amount: '$1,974.00' }), /Pay balance/)
    assert.match(tPublicOps('es', 'payFullChoice', { amount: 'US$ 2.820,00' }), /Pagar todo/)
    assert.equal(tPublicOps('pt', 'paidLabel'), 'PAGO')
    assert.equal(tPublicOps('en', 'paidLabel'), 'PAID')
    assert.equal(tPublicOps('es', 'paidLabel'), 'PAGADO')
    assert.doesNotMatch(tPublicOps('pt', 'payDepositChoice', { amount: 'X' }), /30%/)
    assert.doesNotMatch(tPublicOps('en', 'payBalanceChoice', { amount: 'X' }), /70%/)
  })

  it('operator waiting and full-share copy exists in PT EN ES', () => {
    assert.equal(tPayments('pt', 'awaitingCustomerAcceptance'), 'Aguardando aceite do cliente')
    assert.equal(tPayments('en', 'awaitingCustomerAcceptance'), 'Awaiting customer acceptance')
    assert.equal(tPayments('es', 'awaitingCustomerAcceptance'), 'Esperando aceptación del cliente')
    assert.equal(tPayments('pt', 'sendFullWhatsApp'), 'Enviar pagamento total')
    assert.equal(tPayments('en', 'sendFullWhatsApp'), 'Send full payment')
    assert.equal(tPayments('es', 'sendFullWhatsApp'), 'Enviar pago total')
  })
})
