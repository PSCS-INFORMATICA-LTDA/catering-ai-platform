import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  omitInternalNotes,
  quoteContainsInternalNotes,
  sanitizeInternalNotes,
} from './internalNotes.ts'

describe('internal notes', () => {
  it('sanitizes and truncates internal notes', () => {
    assert.equal(sanitizeInternalNotes('  hello \r\nworld  '), 'hello\nworld')
    assert.equal(sanitizeInternalNotes('x'.repeat(5000)).length, 4000)
    assert.equal(sanitizeInternalNotes(null), '')
  })

  it('strips internal notes from a public/PDF payload', () => {
    const publicQuote = omitInternalNotes({
      id: 'q1',
      quote_number: 'Q-1',
      grill_notes: 'cliente quer brasa',
      internal_notes: 'nao contar desconto extra',
    })
    assert.equal(publicQuote.grill_notes, 'cliente quer brasa')
    assert.equal('internal_notes' in publicQuote, false)
    assert.equal(quoteContainsInternalNotes(publicQuote), false)
    assert.equal(
      quoteContainsInternalNotes({ id: 'q1', internal_notes: 'secret' }),
      true,
    )
  })
})
