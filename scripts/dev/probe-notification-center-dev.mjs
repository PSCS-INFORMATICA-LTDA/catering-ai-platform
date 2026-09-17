/**
 * DEV-only Notification Center probe. Never writes to PROD.
 * Uses a disposable fake quote UUID so Caio's public quote validation is not touched.
 */
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FAKE_QUOTE_ID = '00000000-0000-4000-8000-000000000171'
const FAKE_PHONE = '+15555550171'

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')
  const db = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const probe = await db.from('notification_events').select('id').limit(1)
  if (probe.error) {
    console.log(
      JSON.stringify({
        target_project_ref: DEV_REF,
        tables_ready: false,
        reason: probe.error.message,
        prod_untouched: true,
      }),
    )
    return
  }

  const companyId = env.companyId
  await db
    .from('notification_deliveries')
    .delete()
    .eq('company_id', companyId)
    .in(
      'event_id',
      (
        await db
          .from('notification_events')
          .select('id')
          .eq('company_id', companyId)
          .eq('entity_id', FAKE_QUOTE_ID)
      ).data?.map((row) => row.id) || [],
    )
  await db
    .from('notification_events')
    .delete()
    .eq('company_id', companyId)
    .eq('entity_id', FAKE_QUOTE_ID)
  await db
    .from('notification_recipients')
    .delete()
    .eq('company_id', companyId)
    .eq('phone_e164', FAKE_PHONE)

  const recipient = await db
    .from('notification_recipients')
    .insert({
      company_id: companyId,
      event_key: 'quote.created',
      channel: 'whatsapp',
      display_name: 'QA Notification Center',
      phone_raw: FAKE_PHONE,
      phone_e164: FAKE_PHONE,
      locale: 'pt',
      enabled: true,
    })
    .select('id')
    .single()
  if (recipient.error) throw new Error(recipient.error.message)

  const payload = {
    quoteId: FAKE_QUOTE_ID,
    quoteNumber: 'Q-QA-NOTIFY',
    customerName: 'QA Probe',
    eventDate: '2026-12-01',
    eventTime: '11:00',
    total: 100,
    currency: 'USD',
    locale: 'pt',
    source: 'retry',
    deepLinkPath: `/quotes/${FAKE_QUOTE_ID}`,
  }
  const first = await db
    .from('notification_events')
    .insert({
      company_id: companyId,
      event_key: 'quote.created',
      entity_type: 'quote',
      entity_id: FAKE_QUOTE_ID,
      payload,
      actor_source: 'retry',
    })
    .select('id')
    .single()
  if (first.error) throw new Error(first.error.message)

  const duplicate = await db.from('notification_events').insert({
    company_id: companyId,
    event_key: 'quote.created',
    entity_type: 'quote',
    entity_id: FAKE_QUOTE_ID,
    payload,
    actor_source: 'retry',
  })
  const duplicateBlocked = Boolean(duplicate.error)

  const idempotencyKey = `${companyId}:quote.created:${FAKE_QUOTE_ID}:${recipient.data.id}:whatsapp`
  await db.from('notification_deliveries').insert({
    company_id: companyId,
    event_id: first.data.id,
    recipient_id: recipient.data.id,
    channel: 'whatsapp',
    provider: 'meta_whatsapp',
    template_key: 'new_quote_internal',
    status: 'failed',
    last_error: 'whatsapp_disabled',
    idempotency_key: idempotencyKey,
    failed_at: new Date().toISOString(),
  })
  const duplicateDelivery = await db.from('notification_deliveries').insert({
    company_id: companyId,
    event_id: first.data.id,
    recipient_id: recipient.data.id,
    channel: 'whatsapp',
    provider: 'meta_whatsapp',
    template_key: 'new_quote_internal',
    status: 'pending',
    idempotency_key: idempotencyKey,
  })

  const { data: events } = await db
    .from('notification_events')
    .select('id')
    .eq('company_id', companyId)
    .eq('entity_id', FAKE_QUOTE_ID)
  const { data: deliveries } = await db
    .from('notification_deliveries')
    .select('id, status, last_error')
    .eq('company_id', companyId)
    .eq('event_id', first.data.id)

  const otherCompany = await db
    .from('notification_events')
    .select('id')
    .eq('company_id', randomUUID())
    .eq('entity_id', FAKE_QUOTE_ID)

  const result = {
    target_project_ref: DEV_REF,
    tables_ready: true,
    events: events?.length ?? 0,
    deliveries: deliveries?.length ?? 0,
    duplicate_event_blocked: duplicateBlocked,
    duplicate_delivery_blocked: Boolean(duplicateDelivery.error),
    other_company_empty: (otherCompany.data ?? []).length === 0,
    sanitized_error: deliveries?.[0]?.last_error === 'whatsapp_disabled',
    prod_untouched: true,
  }

  await db.from('notification_deliveries').delete().eq('company_id', companyId).eq('event_id', first.data.id)
  await db.from('notification_events').delete().eq('id', first.data.id)
  await db.from('notification_recipients').delete().eq('id', recipient.data.id)

  console.log(JSON.stringify(result))
  if (
    result.events !== 1 ||
    result.deliveries !== 1 ||
    !result.duplicate_event_blocked ||
    !result.duplicate_delivery_blocked ||
    !result.other_company_empty
  ) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
