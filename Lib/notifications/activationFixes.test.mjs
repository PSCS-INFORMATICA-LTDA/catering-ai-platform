import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canAdvanceDeliveryStatus } from './deliveryStatusRank.ts'
import { isRecipientSendable, recipientSendBlockReason } from './recipientConsent.ts'
import {
  classifyStuckProcessing,
  isQueueEligibleDelivery,
  selectClaimableBeforeLimit,
} from './queueRecovery.ts'
import { NOTIFICATION_EVENT_EMBED, NOTIFICATION_RECIPIENT_EMBED } from './embeds.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('only confirmed consent is sendable on every path', () => {
  assert.equal(isRecipientSendable({ enabled: true, consent_status: 'confirmed' }), true)
  assert.equal(isRecipientSendable({ enabled: true, consent_status: null }), false)
  assert.equal(isRecipientSendable({ enabled: true, consent_status: undefined }), false)
  assert.equal(isRecipientSendable({ enabled: true, consent_status: 'unknown' }), false)
  assert.equal(isRecipientSendable({ enabled: true, consent_status: 'denied' }), false)
  assert.equal(isRecipientSendable({ enabled: false, consent_status: 'confirmed' }), false)
  assert.equal(recipientSendBlockReason({ enabled: true, consent_status: null }), 'recipient_consent_missing')

  const enqueue = read('Lib/notifications/enqueueEvent.ts')
  const process = read('Lib/notifications/processDeliveryQueue.ts')
  const retry = read('Lib/notifications/retryDelivery.ts')
  const testRoute = read('app/api/notifications/test/route.ts')
  assert.match(enqueue, /isRecipientSendable/)
  assert.doesNotMatch(enqueue, /ignoreConsent/)
  assert.doesNotMatch(enqueue, /consent == null/)
  assert.match(process, /isRecipientSendable|recipientSendBlockReason/)
  assert.match(retry, /isRecipientSendable|recipientSendBlockReason/)
  assert.match(retry, /consent_status/)
  const dispatch = read('Lib/notifications/dispatch.ts')
  assert.match(dispatch, /recipientSendBlockReason/)
  assert.doesNotMatch(testRoute, /ignoreConsent/)
  assert.match(testRoute, /consent_status/)
})

test('stuck processing distinguishes lease from possibly-sent', () => {
  assert.equal(classifyStuckProcessing({ send_attempted_at: null, provider_message_id: null }), 'pending')
  assert.equal(classifyStuckProcessing({ send_attempted_at: '2026-09-18T00:00:00Z', provider_message_id: null }), 'uncertain')
  assert.equal(classifyStuckProcessing({ send_attempted_at: null, provider_message_id: 'wamid.1' }), 'uncertain')
  const process = read('Lib/notifications/processDeliveryQueue.ts')
  const dispatch = read('Lib/notifications/dispatch.ts')
  assert.match(dispatch, /send_attempted_at/)
  assert.match(process, /recovered_possibly_sent|classifyStuckProcessing|send_attempted_at/)
  assert.doesNotMatch(process, /recovered_stuck_processing/)
})

test('exhausted failed rows are excluded before LIMIT', () => {
  const rows = [
    { id: 'old-failed', status: 'failed', attempt_count: 5, max_attempts: 5 },
    { id: 'old-failed-2', status: 'failed', attempt_count: 8, max_attempts: 5 },
    { id: 'fresh', status: 'pending', attempt_count: 0, max_attempts: 5 },
  ]
  assert.equal(isQueueEligibleDelivery(rows[0]), false)
  assert.deepEqual(selectClaimableBeforeLimit(rows, 1).map((row) => row.id), ['fresh'])
  const process = read('Lib/notifications/processDeliveryQueue.ts')
  const migration = read('supabase/migrations/20260918213000_notification_center_v13_lineage.sql')
  assert.match(process, /queue_eligible/)
  assert.match(migration, /queue_eligible boolean/)
  assert.match(migration, /attempt_count < max_attempts/)
})

test('disabled recipient or provider never sends and db errors are not empty success', () => {
  assert.equal(isRecipientSendable({ enabled: false, consent_status: 'confirmed' }), false)
  const process = read('Lib/notifications/processDeliveryQueue.ts')
  const resolve = read('Lib/notifications/resolveProvider.ts')
  const worker = read('app/api/notifications/worker/route.ts')
  assert.match(process, /queue_list_failed|queue_recover_failed/)
  assert.match(process, /recipient_disabled|recipientSendBlockReason/)
  assert.match(resolve, /provider_disabled/)
  assert.match(worker, /status: 500/)
  assert.doesNotMatch(process, /return \{[^}]*processed: 0[^}]*\}[\s\S]*pending.error/)
})

test('concurrent claim uses status predicate so the second worker cannot send', () => {
  const dispatch = read('Lib/notifications/dispatch.ts')
  assert.match(dispatch, /\.in\('status', \['pending', 'failed'\]\)/)
  assert.match(dispatch, /not_claimable/)
})

test('repeated and out-of-order Meta callbacks do not regress status', () => {
  assert.equal(canAdvanceDeliveryStatus('delivered', 'delivered'), false)
  assert.equal(canAdvanceDeliveryStatus('read', 'read'), false)
  assert.equal(canAdvanceDeliveryStatus('read', 'sent'), false)
  assert.equal(canAdvanceDeliveryStatus('delivered', 'sent'), false)
  assert.equal(canAdvanceDeliveryStatus('sent', 'delivered'), true)
  assert.equal(canAdvanceDeliveryStatus('uncertain', 'sent'), true)
  assert.equal(canAdvanceDeliveryStatus('uncertain', 'failed'), true)
})

test('v13 lineage migration adds composite FKs and revokes authenticated writes on events', () => {
  const sql = read('supabase/migrations/20260918213000_notification_center_v13_lineage.sql')
  assert.match(sql, /notification_subscriptions_recipient_tenant_fkey/)
  assert.match(sql, /notification_deliveries_event_tenant_fkey/)
  assert.match(sql, /notification_deliveries_recipient_tenant_fkey/)
  assert.match(sql, /notification_recipients_person_tenant_fkey/)
  assert.match(sql, /revoke all on table public.notification_events from public, anon, authenticated/)
  assert.match(sql, /revoke all on table public.notification_deliveries from public, anon, authenticated/)
  assert.match(sql, /grant select on table public.notification_events to authenticated/)
  assert.doesNotMatch(sql, /grant insert, update, delete on table public.notification_events/)
  assert.doesNotMatch(sql, /2242|Caio|407915/)
  assert.match(sql, /finance.invoices.view/)
})

test('PostgREST embeds use column hints after composite FKs', () => {
  assert.equal(NOTIFICATION_EVENT_EMBED, 'notification_events!event_id')
  assert.equal(NOTIFICATION_RECIPIENT_EMBED, 'notification_recipients!recipient_id')
  for (const rel of [
    'Lib/notifications/enqueueEvent.ts',
    'Lib/notifications/processDeliveryQueue.ts',
    'Lib/notifications/loadActivityCenter.ts',
    'app/settings/notifications/page.tsx',
    'app/api/notifications/deliveries/route.ts',
  ]) {
    const src = read(rel)
    assert.match(
      src,
      /notification_events!event_id|notification_recipients!recipient_id|NOTIFICATION_EVENT_EMBED|NOTIFICATION_RECIPIENT_EMBED/,
    )
  }
})

test('Meta checklist never prints secrets or marks templates approved', () => {
  const checklist = read('Lib/notifications/metaChecklist.ts')
  assert.match(checklist, /NÃO VERIFICADO/)
  assert.doesNotMatch(checklist, /approved/)
  assert.doesNotMatch(checklist, /EAA[A-Za-z0-9]|sk_live/)
  const diagnosis = read('Lib/notifications/diagnosis.ts')
  assert.match(diagnosis, /buildMetaChecklist|metaChecklist/)
  assert.doesNotMatch(diagnosis, /approved/)
})
