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
    assert.match(tPublicOps('pt', 'balanceNotAvailableYet'), /início do evento/)
    assert.match(tPublicOps('en', 'balanceLockedUntil', { when: '30 Sep' }), /Balance available from/)
    assert.match(tPublicOps('es', 'balanceNotAvailableYet'), /inicio del evento/)
    assert.equal(tPayments('pt', 'children4To12'), 'Crianças 4–12')
    assert.equal(tPayments('en', 'childrenUnder3'), 'Children 0–3')
    assert.equal(tPayments('es', 'billableGuests'), 'Equivalente facturable')
    assert.match(tPayments('pt', 'couponDoesNotApplyToDeposit'), /não reduz o sinal/)
    assert.match(tPayments('en', 'couponDoesNotApplyToDeposit'), /does not reduce the deposit/)
    assert.match(tPayments('es', 'couponDoesNotApplyToDeposit'), /no reduce la seña/)
    assert.equal(tPayments('pt', 'mileageDistance'), 'Distância considerada')
    assert.equal(tPayments('en', 'mileageChargeable'), 'Billable trip distance')
    assert.equal(tPayments('es', 'mileageTotal'), 'Total de millas')
    assert.match(tPayments('pt', 'mileageFullTrip'), /ida e volta/)
    assert.match(tPayments('en', 'mileageFullTrip'), /round trip/)
    assert.match(tPayments('es', 'mileageFullTrip'), /ida y vuelta/)
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
