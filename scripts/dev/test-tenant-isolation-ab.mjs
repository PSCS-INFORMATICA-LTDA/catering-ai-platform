/**
 * Issue #52 — Company A/B RLS harness on live DEV.
 * JWT users prove isolation. service_role is setup/teardown only.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv, DEV_REF } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_A = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const COMPANY_B = 'a1111111-1111-4111-8111-111111111111'
const SENTINEL = '00000000-0000-4000-8000-000000000000'

const env = loadDevEnv(root)
assertDevUrl(env.url)
if (!env.anon || !env.service) {
  console.error('Missing Supabase keys')
  process.exit(2)
}

const admin = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const stamp = Date.now()
const password = `Mc-${randomBytes(12).toString('hex')}!aA1`
const emailA = `qa.mc.a.${stamp}@example.test`
const emailB = `qa.mc.b.${stamp}@example.test`
const created = {
  userIds: [],
  membershipIds: [],
  customerIds: [],
  packageIds: [],
  eventIds: [],
  quoteIds: [],
  invoiceIds: [],
  paymentIds: [],
  conversationIds: [],
  messageIds: [],
  mediaIds: [],
}

const rows = []
function record(id, ok, detail) {
  rows.push({ id, result: ok ? 'PASS' : 'FAIL', detail: detail || '-' })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${id} | ${detail || '-'}`)
}

function denied(data, error) {
  return !data && (Boolean(error) || data == null)
}

async function signIn(email) {
  const client = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`sign_in_failed:${email}`)
  }
  return client
}

async function createUser(email, companyId, role) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(error?.message || 'create_user')
  created.userIds.push(data.user.id)
  await admin.from('app_users').upsert(
    {
      auth_user_id: data.user.id,
      email,
      full_name: email,
      display_name: email,
      role_key: 'user',
      active: true,
    },
    { onConflict: 'auth_user_id' },
  )
  const membership = await admin
    .from('company_memberships')
    .insert({
      company_id: companyId,
      user_id: data.user.id,
      role,
      active: true,
      status: 'active',
    })
    .select('id')
    .single()
  if (membership.data?.id) created.membershipIds.push(membership.data.id)
  return data.user.id
}

async function seedAssistantPersona() {
  const { data } = await admin
    .from('commercial_rules')
    .select('id')
    .eq('company_id', COMPANY_A)
    .eq('rule_key', 'assistant_persona')
    .eq('active', true)
    .maybeSingle()
  if (data?.id) return
  await admin.from('commercial_rules').insert({
    company_id: COMPANY_A,
    rule_key: 'assistant_persona',
    rule_type: 'company_setting',
    active: true,
    rule_value: {
      name: 'Brasinha',
      role: 'Assistente digital da CDL Services BBQ At Home.',
      location_label: 'Orlando, Florida',
      occasional_emoji: '🔥',
    },
  })
}

async function seedCompanyBGraph() {
  const customer = await admin
    .from('customers')
    .insert({
      company_id: COMPANY_B,
      full_name: `QA-MC-B-${stamp}`,
      customer_type: 'person',
      active: true,
      country: 'US',
    })
    .select('id')
    .single()
  if (customer.data?.id) created.customerIds.push(customer.data.id)

  const pkg = await admin
    .from('packages')
    .insert({
      company_id: COMPANY_B,
      package_key: `QA-MC-B-${stamp}`,
      package_name: `QA-MC-B-${stamp}`,
      label_pt: `QA-MC-B-${stamp}`,
      price_per_person: 1,
      active: false,
    })
    .select('id')
    .single()
  if (pkg.data?.id) created.packageIds.push(pkg.data.id)

  const event = await admin
    .from('events')
    .insert({
      company_id: COMPANY_B,
      event_name: `QA-MC-B-${stamp}`,
      event_date: '2026-12-20',
      country: 'US',
      adults_count: 10,
      active: true,
    })
    .select('id')
    .single()
  if (event.data?.id) created.eventIds.push(event.data.id)

  const quote = await admin
    .from('quotes')
    .insert({
      company_id: COMPANY_B,
      customer_id: customer.data?.id ?? null,
      event_id: event.data?.id ?? null,
      package_id: pkg.data?.id ?? null,
      quote_number: `Q-MC-B-${stamp}`,
      quote_status: 'draft',
      language: 'en',
      source: 'qa_multicompany',
      active: true,
      currency_code: 'USD',
      physical_guest_count: 10,
    })
    .select('id')
    .single()
  if (quote.data?.id) created.quoteIds.push(quote.data.id)

  if (quote.data?.id) {
    const invoice = await admin
      .from('invoices')
      .insert({
        company_id: COMPANY_B,
        quote_id: quote.data.id,
        invoice_number: `INV-MC-B-${stamp}`,
        status: 'draft',
        locale: 'en',
        currency_code: 'USD',
        invoice_kind: 'original',
        snapshot: { version: 'QA_MC', frozenAt: new Date().toISOString() },
        subtotal: 10,
        total: 10,
        deposit_amount: 3,
        balance_amount: 7,
        paid_total: 0,
        online_payment_fee: 0,
      })
      .select('id')
      .single()
    if (invoice.data?.id) {
      created.invoiceIds.push(invoice.data.id)
      const payment = await admin
        .from('invoice_payments')
        .insert({
          company_id: COMPANY_B,
          invoice_id: invoice.data.id,
          provider: 'bank_transfer',
          purpose: 'deposit',
          amount: 3,
          currency_code: 'USD',
          status: 'created',
          idempotency_key: `qa-mc-b-${stamp}`,
          metadata: { qa: true },
        })
        .select('id')
        .single()
      if (payment.data?.id) created.paymentIds.push(payment.data.id)
    }
  }

  const conversation = await admin
    .from('brasinha_conversations')
    .insert({
      company_id: COMPANY_B,
      channel: 'dev_simulator',
      language: 'en',
    })
    .select('id')
    .single()
  if (conversation.data?.id) {
    created.conversationIds.push(conversation.data.id)
    const message = await admin
      .from('brasinha_messages')
      .insert({
        company_id: COMPANY_B,
        conversation_id: conversation.data.id,
        channel: 'dev_simulator',
        direction: 'inbound',
        role: 'customer',
        language: 'en',
        content: 'qa-mc isolation',
      })
      .select('id')
      .single()
    if (message.data?.id) created.messageIds.push(message.data.id)
  }

  return {
    customerId: customer.data?.id,
    packageId: pkg.data?.id,
    quoteId: quote.data?.id,
    invoiceId: created.invoiceIds[0],
    paymentId: created.paymentIds[0],
    conversationId: conversation.data?.id,
  }
}

async function seedCompanyAProbe() {
  const customer = await admin
    .from('customers')
    .insert({
      company_id: COMPANY_A,
      full_name: `QA-MC-A-${stamp}`,
      customer_type: 'person',
      active: true,
      country: 'US',
    })
    .select('id')
    .single()
  if (customer.data?.id) created.customerIds.push(customer.data.id)
  const pkg = await admin
    .from('packages')
    .insert({
      company_id: COMPANY_A,
      package_key: `QA-MC-A-${stamp}`,
      package_name: `QA-MC-A-${stamp}`,
      label_pt: `QA-MC-A-${stamp}`,
      price_per_person: 1,
      active: false,
    })
    .select('id')
    .single()
  if (pkg.data?.id) created.packageIds.push(pkg.data.id)
  const quote = await admin
    .from('quotes')
    .insert({
      company_id: COMPANY_A,
      customer_id: customer.data?.id ?? null,
      package_id: pkg.data?.id ?? null,
      quote_number: `Q-MC-A-${stamp}`,
      quote_status: 'draft',
      language: 'en',
      source: 'qa_multicompany',
      active: true,
      currency_code: 'USD',
      physical_guest_count: 8,
    })
    .select('id')
    .single()
  if (quote.data?.id) created.quoteIds.push(quote.data.id)
  let invoiceId = null
  let paymentId = null
  if (quote.data?.id) {
    const invoice = await admin
      .from('invoices')
      .insert({
        company_id: COMPANY_A,
        quote_id: quote.data.id,
        invoice_number: `INV-MC-A-${stamp}`,
        invoice_kind: 'original',
        status: 'draft',
        locale: 'en',
        currency_code: 'USD',
        snapshot: { version: 'QA_MC', frozenAt: new Date().toISOString() },
        subtotal: 10,
        total: 10,
        deposit_amount: 3,
        balance_amount: 7,
        paid_total: 0,
        online_payment_fee: 0,
      })
      .select('id')
      .single()
    if (invoice.data?.id) {
      invoiceId = invoice.data.id
      created.invoiceIds.push(invoice.data.id)
      const payment = await admin
        .from('invoice_payments')
        .insert({
          company_id: COMPANY_A,
          invoice_id: invoice.data.id,
          provider: 'bank_transfer',
          purpose: 'deposit',
          amount: 3,
          currency_code: 'USD',
          status: 'created',
          idempotency_key: `qa-mc-a-${stamp}`,
          metadata: { qa: true },
        })
        .select('id')
        .single()
      if (payment.data?.id) {
        paymentId = payment.data.id
        created.paymentIds.push(payment.data.id)
      }
    }
  }
  return {
    customerId: customer.data?.id,
    packageId: pkg.data?.id,
    quoteId: quote.data?.id,
    invoiceId,
    paymentId,
  }
}

async function cleanup() {
  const order = [
    ['brasinha_messages', created.messageIds],
    ['brasinha_conversations', created.conversationIds],
    ['invoice_payments', created.paymentIds],
    ['invoices', created.invoiceIds],
    ['quotes', created.quoteIds],
    ['events', created.eventIds],
    ['packages', created.packageIds],
    ['customers', created.customerIds],
    ['media_assets', created.mediaIds],
    ['company_memberships', created.membershipIds],
  ]
  for (const [table, ids] of order) {
    if (!ids.length) continue
    await admin.from(table).delete().in('id', ids)
  }
  for (const userId of created.userIds) {
    await admin.auth.admin.deleteUser(userId)
  }
}

async function exercise(actorLabel, client, ownId, otherId, otherIds) {
  const prefix = `${actorLabel}`

  const ownCustomer = await client
    .from('customers')
    .select('id, company_id')
    .eq('company_id', ownId)
    .limit(3)
  record(
    `${prefix} SELECT own customers`,
    !ownCustomer.error && (ownCustomer.data?.length ?? 0) > 0,
    ownCustomer.error?.code || `n=${ownCustomer.data?.length ?? 0}`,
  )

  for (const [table, id] of Object.entries(otherIds)) {
    if (!id) {
      record(`${prefix} skip ${table} other`, true, 'fixture_not_seeded')
      continue
    }
    const { data, error } = await client.from(table).select('id').eq('id', id).maybeSingle()
    record(
      `${prefix} cannot SELECT ${table} other`,
      !data,
      error?.code || (data ? 'LEAK' : 'hidden'),
    )
  }

  const insertCustomer = await client
    .from('customers')
    .insert({
      company_id: otherId,
      full_name: `QA-MC-X-${actorLabel}-${stamp}`,
      customer_type: 'person',
      active: true,
      country: 'US',
    })
    .select('id')
    .maybeSingle()
  record(
    `${prefix} cannot INSERT customer other`,
    denied(insertCustomer.data, insertCustomer.error),
    insertCustomer.error?.code || (insertCustomer.data ? 'ALLOWED' : 'denied'),
  )
  if (insertCustomer.data?.id) {
    created.customerIds.push(insertCustomer.data.id)
    await admin.from('customers').delete().eq('id', insertCustomer.data.id)
  }

  if (otherIds.packages) {
    const upd = await client
      .from('packages')
      .update({ image_notes: `should-fail-${actorLabel}` })
      .eq('id', otherIds.packages)
      .select('id')
      .maybeSingle()
    record(
      `${prefix} cannot UPDATE package other`,
      !upd.data,
      upd.error?.code || (upd.data ? 'ALLOWED' : 'denied'),
    )
    const del = await client
      .from('packages')
      .delete()
      .eq('id', otherIds.packages)
      .select('id')
      .maybeSingle()
    record(
      `${prefix} cannot DELETE package other`,
      !del.data,
      del.error?.code || (del.data ? 'ALLOWED' : 'denied'),
    )
  }

  if (otherIds.invoices) {
    const upd = await client
      .from('invoices')
      .update({ locale: 'es' })
      .eq('id', otherIds.invoices)
      .select('id')
      .maybeSingle()
    record(
      `${prefix} cannot UPDATE invoice other`,
      !upd.data,
      upd.error?.code || (upd.data ? 'ALLOWED' : 'denied'),
    )
  }

  if (otherIds.invoice_payments) {
    const seen = await client
      .from('invoice_payments')
      .select('id')
      .eq('id', otherIds.invoice_payments)
      .maybeSingle()
    record(
      `${prefix} cannot SELECT payment other`,
      !seen.data,
      seen.error?.code || (seen.data ? 'LEAK' : 'hidden'),
    )
  }

  const providers = await client
    .from('company_payment_providers')
    .select('id, company_id')
    .eq('company_id', otherId)
  record(
    `${prefix} cannot SELECT payment providers other`,
    (providers.data?.length ?? 0) === 0,
    providers.error?.code || `n=${providers.data?.length ?? 0}`,
  )

  const sentinel = await client
    .from('document_sequences')
    .select('id')
    .eq('company_id', SENTINEL)
  record(
    `${prefix} cannot SELECT sentinel sequence`,
    (sentinel.data?.length ?? 0) === 0,
    sentinel.error?.code || `n=${sentinel.data?.length ?? 0}`,
  )
}

async function publicTokenIsolation(clientA) {
  const settingsB = await clientA
    .from('company_public_quote_settings')
    .select('company_id, enabled')
    .eq('company_id', COMPANY_B)
    .maybeSingle()
  record(
    'A cannot SELECT B public quote settings',
    !settingsB.data,
    settingsB.error?.code || (settingsB.data ? 'LEAK' : 'hidden'),
  )

  const packagesB = await clientA
    .from('packages')
    .select('id, company_id')
    .eq('company_id', COMPANY_B)
  record(
    'A cannot SELECT B catalog packages',
    (packagesB.data?.length ?? 0) === 0,
    packagesB.error?.code || `n=${packagesB.data?.length ?? 0}`,
  )

  const mediaB = await clientA
    .from('media_assets')
    .select('id')
    .eq('company_id', COMPANY_B)
  record(
    'A cannot SELECT B media',
    (mediaB.data?.length ?? 0) === 0,
    mediaB.error?.code || `n=${mediaB.data?.length ?? 0}`,
  )

  const couponsB = await clientA
    .from('coupons')
    .select('id')
    .eq('company_id', COMPANY_B)
  record(
    'A cannot SELECT B coupons',
    (couponsB.data?.length ?? 0) === 0,
    couponsB.error?.code || `n=${couponsB.data?.length ?? 0}`,
  )
}

async function main() {
  console.log(JSON.stringify({ project_ref: DEV_REF, harness: 'company_a_b', stamp }))
  try {
    await seedAssistantPersona()
    const userA = await createUser(emailA, COMPANY_A, 'viewer')
    const userB = await createUser(emailB, COMPANY_B, 'viewer')
    record('setup user A membership', Boolean(userA), emailA)
    record('setup user B membership', Boolean(userB), emailB)

    const aProbe = await seedCompanyAProbe()
    const bGraph = await seedCompanyBGraph()
    record('setup A customer fixture', Boolean(aProbe.customerId), aProbe.customerId || 'missing')
    record('setup B quote fixture', Boolean(bGraph.quoteId), bGraph.quoteId || 'missing')
    record('setup B invoice fixture', Boolean(bGraph.invoiceId), bGraph.invoiceId || 'missing')

    const clientA = await signIn(emailA)
    const clientB = await signIn(emailB)

    const idsB = {
      customers: bGraph.customerId,
      packages: bGraph.packageId,
      quotes: bGraph.quoteId,
      invoices: bGraph.invoiceId,
      invoice_payments: bGraph.paymentId,
      brasinha_conversations: bGraph.conversationId,
    }
    const idsA = {
      customers: aProbe.customerId,
      packages: aProbe.packageId,
      quotes: aProbe.quoteId,
      invoices: aProbe.invoiceId,
      invoice_payments: aProbe.paymentId,
      brasinha_conversations: null,
    }

    await exercise('A', clientA, COMPANY_A, COMPANY_B, idsB)
    await publicTokenIsolation(clientA)
    await exercise('B', clientB, COMPANY_B, COMPANY_A, idsA)

    const ownA = await clientA
      .from('customers')
      .select('id')
      .eq('id', aProbe.customerId)
      .maybeSingle()
    record('A can SELECT own customer', Boolean(ownA.data?.id), ownA.error?.code || ownA.data?.id)

    const ownB = await clientB
      .from('quotes')
      .select('id')
      .eq('id', bGraph.quoteId)
      .maybeSingle()
    record('B can SELECT own quote', Boolean(ownB.data?.id), ownB.error?.code || ownB.data?.id)

    const crossQuote = await clientA
      .from('quotes')
      .select('id, company_id')
      .eq('company_id', COMPANY_B)
    record(
      'A cannot SELECT B quotes unfiltered',
      (crossQuote.data?.length ?? 0) === 0,
      `n=${crossQuote.data?.length ?? 0}`,
    )

    const brasinha = await clientA
      .from('brasinha_messages')
      .select('id')
      .eq('company_id', COMPANY_B)
    record(
      'A cannot SELECT B Brasinha messages',
      (brasinha.data?.length ?? 0) === 0,
      `n=${brasinha.data?.length ?? 0}`,
    )

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  } catch (error) {
    record('harness', false, error instanceof Error ? error.message : String(error))
  } finally {
    await cleanup()
  }

  const failed = rows.filter((row) => row.result === 'FAIL')
  console.log('---')
  console.log(`COMPANY_A_B_TEST_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'}`)
  console.log(`passed=${rows.filter((r) => r.result === 'PASS').length}`)
  console.log(`failed=${failed.length}`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
