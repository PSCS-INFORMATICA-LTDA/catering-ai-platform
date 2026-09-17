import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260917190000_notification_center_v1.sql')
const enqueue = read('Lib/notifications/enqueueQuoteCreated.ts')
const provider = read('Lib/notifications/providers/whatsappMeta.ts')
const create = read('Lib/createQuote.ts')
const submit = read('app/api/public/quote-intake/submit/route.ts')
const pdf = read('components/payments/InvoicePdfDocument.tsx')

assert.match(migration, /notification_events/)
assert.match(migration, /notification_recipients/)
assert.match(migration, /notification_deliveries/)
assert.match(migration, /private.has_permission\(company_id, 'notifications.view'\)/)
assert.match(migration, /notification_events_idem_uidx/)
assert.match(migration, /notification_deliveries_idem_uidx/)
assert.doesNotMatch(migration, /TO authenticated\nusing \(true\)/)
assert.match(enqueue, /ignoreDuplicates: true/)
assert.match(create, /enqueueQuoteCreatedNotificationSafe/)
assert.match(submit, /enqueueQuoteCreatedNotificationSafe/)
assert.match(provider, /WHATSAPP|whatsapp_disabled|graph\.facebook\.com/)
assert.doesNotMatch(provider, /4079152242|Caio/)
assert.match(pdf, /INVOICE_LOGO_PDF/)
assert.match(pdf, /sectionPackage|sectionSides|sectionAddons/)

console.log('NOTIFICATION_CENTER_CONTRACT=PASS')
console.log('INVOICE_POLISH_CONTRACT=PASS')
