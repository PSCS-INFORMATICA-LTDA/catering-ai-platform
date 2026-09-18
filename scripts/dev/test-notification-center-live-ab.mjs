/**
 * Live DEV application tests after the combined V1–V1.3 bundle.
 * Uses existing CDL + TEST-DEV-ISO. Rolls back every QA row.
 * Never records Caio consent, never enables a provider, never calls Meta.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectNotificationCenterDev, VERIFIED_COMBINED_BUNDLE } from './inspect-notification-center-dev.mjs'

function isRecipientSendable(recipient) {
  return recipient?.consent_status === 'confirmed'
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const QA_A = '+15555550171'
const QA_B = '+15555550172'
const TAG = 'qa-nc-live-ab'

const report = {
  target_project_ref: DEV_REF,
  recognized_bundle: VERIFIED_COMBINED_BUNDLE.name,
  e2e: false,
  whatsapp_sent: false,
  consent_recorded_for_pilot: false,
  provider_enabled: false,
  checks: {},
  leftover_qa_rows: null,
  prod_untouched: true,
}

function ok(name, value, detail) {
  report.checks[name] = { ok: Boolean(value), detail: detail ?? null }
  if (!value) report.failed = true
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')
  const admin = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const inspect = await inspectNotificationCenterDev()
  ok('schema_applied', inspect.inferred_package.status === 'APLICADO', inspect.inferred_package.status)
  ok('do_not_reapply', inspect.do_not_reapply === true)
  ok('bundle_version', inspect.verified_combined_bundle?.version === VERIFIED_COMBINED_BUNDLE.version)
  ok('empty_before', Object.values(inspect.row_counts || {}).every((count) => count === 0), inspect.row_counts)

  const companies = await admin.from('companies').select('id, company_code').in('id', [CDL, ISO])
  ok(
    'companies_present',
    (companies.data || []).some((row) => row.id === CDL && row.company_code === 'CDL') &&
      (companies.data || []).some((row) => row.id === ISO && row.company_code === 'TEST-DEV-ISO'),
  )

  const recA = randomUUID()
  const recB = randomUUID()
  const evA = randomUUID()
  const evB = randomUUID()
  const ids = { recA, recB, evA, evB }

  try {
    const insA = await admin.from('notification_recipients').insert({
      id: recA,
      company_id: CDL,
      channel: 'whatsapp',
      locale: 'pt',
      display_name: TAG,
      phone_e164: QA_A,
      phone_raw: QA_A,
    }).select('id, consent_status').single()
    const insB = await admin.from('notification_recipients').insert({
      id: recB,
      company_id: ISO,
      channel: 'whatsapp',
      locale: 'pt',
      display_name: TAG,
      phone_e164: QA_B,
      phone_raw: QA_B,
    }).select('id, consent_status').single()
    ok('same_company_recipients', !insA.error && !insB.error, insA.error?.message || insB.error?.message)
    ok('consent_default_unknown', insA.data?.consent_status === 'unknown' && insB.data?.consent_status === 'unknown')
    ok('unknown_not_sendable', isRecipientSendable(insA.data) === false)

    const evInsA = await admin.from('notification_events').insert({
      id: evA,
      company_id: CDL,
      event_key: 'quote.created',
      entity_type: 'quote',
      entity_id: randomUUID(),
      payload: { source: TAG },
    })
    const evInsB = await admin.from('notification_events').insert({
      id: evB,
      company_id: ISO,
      event_key: 'quote.created',
      entity_type: 'quote',
      entity_id: randomUUID(),
      payload: { source: TAG },
    })
    const subA = await admin.from('notification_subscriptions').insert({
      company_id: CDL,
      recipient_id: recA,
      event_key: 'quote.created',
      enabled: true,
    })
    const subB = await admin.from('notification_subscriptions').insert({
      company_id: ISO,
      recipient_id: recB,
      event_key: 'quote.created',
      enabled: true,
    })
    const delA = await admin.from('notification_deliveries').insert({
      company_id: CDL,
      event_id: evA,
      recipient_id: recA,
      channel: 'whatsapp',
      idempotency_key: `${TAG}-a`,
      status: 'pending',
    })
    ok(
      'same_company_graph',
      !evInsA.error && !evInsB.error && !subA.error && !subB.error && !delA.error,
      evInsA.error?.message || subA.error?.message || delA.error?.message,
    )

    const crossSub = await admin.from('notification_subscriptions').insert({
      company_id: CDL,
      recipient_id: recB,
      event_key: 'quote.created',
      enabled: true,
    })
    const crossEvent = await admin.from('notification_deliveries').insert({
      company_id: CDL,
      event_id: evB,
      recipient_id: recA,
      channel: 'whatsapp',
      idempotency_key: `${TAG}-cross-event`,
    })
    const crossRec = await admin.from('notification_deliveries').insert({
      company_id: CDL,
      event_id: evA,
      recipient_id: recB,
      channel: 'whatsapp',
      idempotency_key: `${TAG}-cross-rec`,
    })
    ok('reject_cross_subscription', Boolean(crossSub.error), crossSub.error?.code || crossSub.error?.message)
    ok('reject_cross_event', Boolean(crossEvent.error), crossEvent.error?.code || crossEvent.error?.message)
    ok('reject_cross_recipient', Boolean(crossRec.error), crossRec.error?.code || crossRec.error?.message)

    const evQueue = []
    for (let i = 0; i < 3; i += 1) {
      const id = randomUUID()
      evQueue.push(id)
      const ev = await admin.from('notification_events').insert({
        id,
        company_id: ISO,
        event_key: 'quote.created',
        entity_type: 'quote',
        entity_id: randomUUID(),
        payload: { source: TAG, queue: i },
      })
      if (ev.error) throw new Error(ev.error.message)
    }
    const exhausted = await admin.from('notification_deliveries').insert({
      company_id: ISO,
      event_id: evQueue[0],
      recipient_id: recB,
      channel: 'whatsapp',
      idempotency_key: `${TAG}-exhausted`,
      status: 'failed',
      attempt_count: 5,
      max_attempts: 5,
    }).select('queue_eligible').single()
    const pending = await admin.from('notification_deliveries').insert({
      company_id: ISO,
      event_id: evQueue[1],
      recipient_id: recB,
      channel: 'whatsapp',
      idempotency_key: `${TAG}-pending`,
      status: 'pending',
    }).select('queue_eligible').single()
    const uncertain = await admin.from('notification_deliveries').insert({
      company_id: ISO,
      event_id: evQueue[2],
      recipient_id: recB,
      channel: 'whatsapp',
      idempotency_key: `${TAG}-uncertain`,
      status: 'uncertain',
      send_attempted_at: new Date().toISOString(),
    }).select('queue_eligible').single()
    ok('queue_exhausted_excluded', exhausted.data?.queue_eligible === false, exhausted.error?.message)
    ok('queue_pending_included', pending.data?.queue_eligible === true, pending.error?.message)
    ok('queue_uncertain_excluded', uncertain.data?.queue_eligible === false, uncertain.error?.message)

    const anon = createClient(env.url, env.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const anonRead = await anon.from('notification_events').select('id').limit(1)
    ok('anon_cannot_read_events', Boolean(anonRead.error) || (anonRead.data || []).length === 0, anonRead.error?.code)

    const email = process.env.CATERING_DEV_LOGIN_EMAIL || ''
    const password = process.env.CATERING_DEV_LOGIN_PASSWORD || ''
    if (email && password) {
      const user = createClient(env.url, env.anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const signed = await user.auth.signInWithPassword({ email, password })
      ok('qa_login', !signed.error, signed.error?.message?.slice(0, 80))
      if (!signed.error) {
        const seen = await user.from('notification_recipients').select('id, company_id, display_name')
        const rows = seen.data || []
        const isoRows = rows.filter((row) => row.company_id === ISO)
        const cdlRows = rows.filter((row) => row.company_id === CDL)
        report.checks.qa_rls = {
          ok: true,
          detail: {
            total: rows.length,
            cdl: cdlRows.length,
            iso: isoRows.length,
            platform_master_may_read_both: isoRows.length > 0,
            ui_must_still_filter_active_company: true,
          },
        }
        const insertEvent = await user.from('notification_events').insert({
          company_id: CDL,
          event_key: 'quote.created',
          entity_type: 'quote',
          entity_id: randomUUID(),
          payload: { source: TAG },
        })
        ok('authenticated_cannot_insert_events', Boolean(insertEvent.error), insertEvent.error?.code)
        const rpc = await user.rpc('read_company_notification_secret', {
          p_company_id: CDL,
          p_channel: 'whatsapp',
          p_provider: 'pscs_shared',
        })
        ok('authenticated_cannot_read_secret_rpc', Boolean(rpc.error) || rpc.data == null, rpc.error?.code)
      }
    } else {
      ok('qa_login', false, 'missing_dev_login')
    }
  } finally {
    await admin.from('notification_deliveries').delete().like('idempotency_key', `${TAG}%`)
    await admin.from('notification_subscriptions').delete().in('recipient_id', [ids.recA, ids.recB])
    await admin.from('notification_events').delete().in('id', [ids.evA, ids.evB])
    await admin.from('notification_events').delete().contains('payload', { source: TAG })
    await admin.from('notification_recipients').delete().in('id', [ids.recA, ids.recB])
    await admin.from('notification_recipients').delete().eq('display_name', TAG)
    const leftover = {}
    for (const table of ['notification_recipients', 'notification_events', 'notification_deliveries']) {
      leftover[table] = (await admin.from(table).select('id', { count: 'exact', head: true })).count
    }
    report.leftover_qa_rows = leftover
    ok('rollback_clean', Object.values(leftover).every((count) => count === 0), leftover)
  }

  console.log(JSON.stringify(report, null, 2))
  if (report.failed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
