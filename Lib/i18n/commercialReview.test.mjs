import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tCommercialReview } from './commercialReview.ts'

describe('commercial review i18n', () => {
  it('localizes workspace chrome in PT EN ES', () => {
    assert.equal(tCommercialReview('pt', 'title'), 'Revisão comercial')
    assert.equal(tCommercialReview('en', 'title'), 'Commercial review')
    assert.equal(tCommercialReview('es', 'title'), 'Revisión comercial')
    assert.equal(
      tCommercialReview('pt', 'proposalPendingBlocked'),
      'Decida o cupom pendente antes de compartilhar a proposta.',
    )
    assert.match(
      tCommercialReview('en', 'proposalPendingBlocked'),
      /before sharing the proposal/i,
    )
    assert.match(
      tCommercialReview('es', 'proposalPendingBlocked'),
      /antes de compartir la propuesta/i,
    )
    assert.equal(tCommercialReview('pt', 'capacityAvailable'), 'Disponível')
    assert.equal(tCommercialReview('en', 'capacityAttention'), 'Attention')
    assert.equal(tCommercialReview('es', 'capacityBlocked'), 'Bloqueado')
    assert.doesNotMatch(tCommercialReview('pt', 'notesPlaceholder'), /CDL10|WELCOME/i)
  })
})
