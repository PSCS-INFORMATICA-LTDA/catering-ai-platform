import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notificationIdempotencyKey, toE164 } from './e164.ts'
import { quoteDeepLinkPath, invoiceDeepLinkPath } from './env.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('E.164 keeps the source number and only formats delivery', () => {
  assert.equal(toE164('+1 (407) 915-2242'), '+14079152242')
  assert.equal(toE164('4079152242'), '+14079152242')
  assert.equal(toE164(''), null)
})

test('idempotency key is company+event+entity+recipient+channel', () => {
  assert.equal(
    notificationIdempotencyKey({
      companyId: 'co-1',
      eventKey: 'quote.created',
      entityId: 'q-1',
      recipientId: 'r-1',
      channel: 'whatsapp',
    }),
    'co-1:quote.created:q-1:r-1:whatsapp',
  )
})

test('deep links are authenticated internal paths', () => {
  assert.equal(quoteDeepLinkPath('abc'), '/quotes/abc')
  assert.equal(invoiceDeepLinkPath('inv'), '/invoices/inv')
  const enqueue = read('Lib/notifications/enqueueEvent.ts')
  assert.doesNotMatch(enqueue, /token=|public\/quotes/)
})

test('quote persist hooks are post-commit and never roll back the quote', () => {
  const create = read('Lib/createQuote.ts')
  const submit = read('app/api/public/quote-intake/submit/route.ts')
  const accept = read('app/api/public/proposta/[token]/route.ts')
  assert.match(create, /enqueueQuoteCreatedNotificationSafe/)
  assert.match(submit, /enqueueQuoteCreatedNotificationSafe/)
  assert.match(create, /void enqueueQuoteCreatedNotificationSafe/)
  assert.doesNotMatch(create, /await enqueueQuoteCreatedNotificationSafe/)
  assert.match(accept, /void enqueueQuoteAcceptedNotificationSafe/)
})

test('WhatsApp provider is abstracted and secret-safe', () => {
  const provider = read('Lib/notifications/providers/whatsappMeta.ts')
  const create = read('Lib/createQuote.ts')
  const submit = read('app/api/public/quote-intake/submit/route.ts')
  assert.match(provider, /graph\.facebook\.com/)
  assert.doesNotMatch(create, /graph\.facebook\.com/)
  assert.doesNotMatch(submit, /graph\.facebook\.com/)
  assert.doesNotMatch(provider, /Caio|4079152242/)
})

test('quote.created payload keeps a catering event reference without duplicating the quote', () => {
  const types = read('Lib/notifications/types.ts')
  const enqueue = read('Lib/notifications/enqueueQuoteCreated.ts')
  const create = read('Lib/createQuote.ts')
  assert.match(types, /eventId\?: string \| null/)
  assert.match(enqueue, /eventId: cateringEventId/)
  assert.match(create, /eventId,/)
  assert.doesNotMatch(enqueue, /pricingBreakdown|internalNotes|margin/)
})

test('public quote flow files are not redesigned by this hook', () => {
  const submit = read('app/api/public/quote-intake/submit/route.ts')
  assert.match(submit, /finalize_public_quote/)
  assert.match(submit, /validateCompletePublicQuoteDraft/)
  assert.doesNotMatch(submit, /redesign|wizard step/)
})
