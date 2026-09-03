/**
 * Brasinha V1A persistence, isolation, service timing, extra-hour guard.
 * Run: npm run test:dev:brasinha-persistence
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { extraHourHandoffReply } from '../../Lib/brasinha/core/copy.ts'
import { detectBrasinhaIntent } from '../../Lib/brasinha/core/intent.ts'
import { runBrasinhaTurn } from '../../Lib/brasinha/core/runTurn.ts'
import { createWhatsAppChannel, whatsappExternalCalls } from '../../Lib/brasinha/channels/whatsapp.ts'
import {
  isBrasinhaDevRuntimeAllowed,
  isWhatsAppChannelEnabled,
} from '../../Lib/brasinha/env.ts'
import { createMemoryConversationStore } from '../../Lib/brasinha/store/memoryConversationStore.ts'
import { createSupabaseConversationStore } from '../../Lib/brasinha/store/supabaseConversationStore.ts'
import { COMPANY_SCOPE_VIOLATION } from '../../Lib/brasinha/store/types.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const source = (relative) => readFileSync(join(ROOT, relative), 'utf8')

let passed = 0
let failed = 0
function test(name, callback) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      passed += 1
      console.log(`PASS  ${name}`)
    })
    .catch((error) => {
      failed += 1
      console.error(`FAIL  ${name}`)
      console.error(`      ${error instanceof Error ? error.message : error}`)
    })
}

function fakePort() {
  const emptyTrace = (tool, companyId, ids = {}) => ({
    tool,
    source: 'test-port',
    companyId,
    ids,
    timestamp: new Date().toISOString(),
  })
  const rules = {
    sidesPricePerPerson: 13,
    waiterServiceFee: 250,
    grillRentalFee: 100,
    minOrderWeekday: 800,
    minOrderWeekend: 1000,
    reservationPercentage: 30,
    serviceDurationHours: 4,
    crewSetupLeadMinutes: 60,
    source: 'test',
  }
  return {
    async getCompanyPublicProfile(companyId) {
      return { data: null, trace: emptyTrace('get_company_public_profile', companyId) }
    },
    async getPackages(companyId) {
      return { data: [], trace: emptyTrace('get_packages', companyId) }
    },
    async getPackageDetails(companyId, query) {
      return { data: null, trace: emptyTrace('get_package_details', companyId, { query }) }
    },
    async getCatalogItem(companyId, query) {
      return { data: null, trace: emptyTrace('get_catalog_item', companyId, { query }) }
    },
    async searchCatalog(companyId, query) {
      return { data: [], trace: emptyTrace('search_catalog', companyId, { query }) }
    },
    async getPublicBusinessRules(companyId) {
      return { data: rules, trace: emptyTrace('get_public_business_rules', companyId) }
    },
    async getQuoteByPublicReference(companyId) {
      return { data: null, trace: emptyTrace('get_quote_by_public_reference', companyId) }
    },
  }
}

await test('SOURCE_PERSISTENCE_ARCHITECTURE', () => {
  const chat = source('app/api/dev/brasinha/chat/route.ts')
  const conversation = source('app/api/dev/brasinha/conversation/route.ts')
  const reset = source('app/api/dev/brasinha/reset/route.ts')
  const store = source('Lib/brasinha/store/supabaseConversationStore.ts')
  const types = source('Lib/brasinha/store/types.ts')
  const migration = source('supabase/migrations/20260903030000_brasinha_conversations_v1a.sql')
  const simulator = source('app/dev/brasinha/BrasinhaDevSimulator.tsx')
  assert.match(types, /export type ConversationStore/)
  assert.match(store, /from\('brasinha_conversations'\)/)
  assert.match(store, /from\('brasinha_messages'\)/)
  assert.match(store, /COMPANY_SCOPE_VIOLATION/)
  assert.match(chat, /createSupabaseConversationStore/)
  assert.match(chat, /rejectSpoofedCompanyId/)
  assert.match(conversation, /rejectSpoofedCompanyId/)
  assert.match(conversation, /resolveAuthorizedCompanyId/)
  assert.match(reset, /deleted: false/)
  assert.doesNotMatch(reset, /\.delete\(/)
  assert.doesNotMatch(migration, /DROP\s+(TABLE|POLICY|INDEX|COLUMN|FUNCTION)/i)
  assert.match(migration, /private\.is_company_member\(company_id\)/)
  assert.match(migration, /CONSTRAINT brasinha_conversations_id_company_key UNIQUE \(id, company_id\)/)
  assert.match(
    migration,
    /FOREIGN KEY \(conversation_id, company_id\)\s+REFERENCES public\.brasinha_conversations \(id, company_id\)/,
  )
  assert.doesNotMatch(
    migration,
    /conversation_id uuid NOT NULL REFERENCES public\.brasinha_conversations\(id\)/,
  )
  assert.match(simulator, /Nova conversa/)
  assert.match(simulator, /conversation id/)
  assert.doesNotMatch(simulator, /<img[^>]+brasinha/i)
})

await test('MEMORY_RECOVER_AND_CROSS_COMPANY_BLOCK', async () => {
  const store = createMemoryConversationStore()
  const first = await runBrasinhaTurn({
    inbound: { channel: 'dev_simulator', companyId: CDL, text: 'Quanto tempo dura o churrasco?' },
    store,
    catalog: fakePort(),
  })
  const recovered = await store.get(CDL, first.conversation.id)
  const messages = await store.listMessages(CDL, first.conversation.id)
  assert.ok(recovered)
  assert.equal(recovered.companyId, CDL)
  assert.ok(messages.length >= 2)
  assert.equal(await store.get(ISO, first.conversation.id), null)
  await assert.rejects(
    () =>
      store.getOrCreate({
        companyId: ISO,
        conversationId: first.conversation.id,
        channel: 'dev_simulator',
        language: 'pt',
      }),
    (error) => error instanceof Error && error.message === COMPANY_SCOPE_VIOLATION,
  )
})

await test('EXTRA_HOUR_NEVER_EXPOSES_INACTIVE_25', async () => {
  assert.equal(detectBrasinhaIntent('Posso contratar mais uma hora?'), 'extra_service_hour')
  const result = await runBrasinhaTurn({
    inbound: { channel: 'dev_simulator', companyId: CDL, text: 'Posso contratar mais uma hora?' },
    store: createMemoryConversationStore(),
    catalog: fakePort(),
  })
  assert.equal(result.conversation.handoffStatus, 'HUMAN_REVIEW_REQUIRED')
  assert.equal(result.reply.text, extraHourHandoffReply('pt'))
  assert.doesNotMatch(result.reply.text, /25/)
  assert.doesNotMatch(source('Lib/brasinha/core/reasoner.ts'), /extraServiceHourPercentage/)
  assert.doesNotMatch(source('Lib/brasinha/tools/types.ts'), /extraServiceHourPercentage/)
})

await test('WHATSAPP_AND_WRITES_STILL_BLOCKED', async () => {
  assert.equal(isWhatsAppChannelEnabled(), false)
  const channel = createWhatsAppChannel()
  assert.equal(channel.enabled, false)
  await assert.rejects(() =>
    channel.send({
      channel: 'whatsapp',
      companyId: CDL,
      conversationId: 'x',
      language: 'pt',
      text: 'hi',
      handoffStatus: 'AI_ACTIVE',
      createdAt: new Date().toISOString(),
    }),
  )
  assert.equal(whatsappExternalCalls, 0)
  assert.equal(
    isBrasinhaDevRuntimeAllowed({
      NEXT_PUBLIC_SUPABASE_URL: 'https://eapwtirhevxrqinytans.supabase.co',
    }),
    false,
  )
  const tools = source('Lib/brasinha/tools/types.ts')
  for (const name of [
    'create_quote_draft',
    'approve_discount',
    'mark_payment_paid',
    'alter_price',
    'alter_invoice',
    'reserve_date',
    'approve_quote',
  ]) {
    assert.match(tools, new RegExp(name))
  }
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const admin = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const created = { conversationIds: [] }

async function cleanup() {
  if (!created.conversationIds.length) return
  await admin.from('brasinha_messages').delete().in('conversation_id', created.conversationIds)
  await admin.from('brasinha_conversations').delete().in('id', created.conversationIds)
}

await test('SUPABASE_TABLES_EXIST', async () => {
  const conversations = await admin.from('brasinha_conversations').select('id').limit(1)
  const messages = await admin.from('brasinha_messages').select('id').limit(1)
  assert.equal(conversations.error, null, conversations.error?.message)
  assert.equal(messages.error, null, messages.error?.message)
})

await test('SUPABASE_CONVERSATION_AND_MESSAGE_PERSIST', async () => {
  const storeA = createSupabaseConversationStore(admin)
  const turn = await runBrasinhaTurn({
    inbound: {
      channel: 'dev_simulator',
      companyId: CDL,
      text: 'Quanto tempo dura o churrasco?',
      externalContactRef: 'brasinha-v1a-test',
    },
    store: storeA,
    catalog: fakePort(),
  })
  created.conversationIds.push(turn.conversation.id)
  assert.match(turn.reply.text, /4 horas/)
  assert.match(turn.reply.text, /1 hora/)

  const storeB = createSupabaseConversationStore(
    createClient(env.url, env.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  )
  const recovered = await storeB.get(CDL, turn.conversation.id)
  const messages = await storeB.listMessages(CDL, turn.conversation.id)
  assert.ok(recovered, 'second request must recover conversation')
  assert.equal(recovered.companyId, CDL)
  assert.ok(messages.length >= 2, 'messages must persist')
  assert.equal(messages[0].content, 'Quanto tempo dura o churrasco?')
  assert.match(messages[1].content, /4 horas/)
  assert.equal(await storeB.get(ISO, turn.conversation.id), null)
})

await test('SUPABASE_CROSS_COMPANY_CONVERSATION_BLOCK', async () => {
  const store = createSupabaseConversationStore(admin)
  const isoId = randomUUID()
  const iso = await store.getOrCreate({
    companyId: ISO,
    conversationId: isoId,
    channel: 'dev_simulator',
    language: 'pt',
    externalContactRef: 'brasinha-v1a-iso',
  })
  created.conversationIds.push(iso.id)
  await assert.rejects(
    () =>
      store.getOrCreate({
        companyId: CDL,
        conversationId: iso.id,
        channel: 'dev_simulator',
        language: 'pt',
      }),
    (error) => error instanceof Error && error.message === COMPANY_SCOPE_VIOLATION,
  )
  assert.equal(await store.get(CDL, iso.id), null)
  assert.deepEqual(await store.listMessages(CDL, iso.id), [])
})

await test('RLS_COMPANY_ISOLATION_AND_ANON', async () => {
  const email = process.env.CATERING_DEV_LOGIN_EMAIL?.trim()
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD?.trim()
  assert.ok(email, 'CATERING_DEV_LOGIN_EMAIL required')
  assert.ok(password, 'CATERING_DEV_LOGIN_PASSWORD required')

  const store = createSupabaseConversationStore(admin)
  const cdl = await store.getOrCreate({
    companyId: CDL,
    channel: 'dev_simulator',
    language: 'pt',
    externalContactRef: 'brasinha-v1a-rls-cdl',
  })
  const iso = await store.getOrCreate({
    companyId: ISO,
    channel: 'dev_simulator',
    language: 'pt',
    externalContactRef: 'brasinha-v1a-rls-iso',
  })
  created.conversationIds.push(cdl.id, iso.id)
  await store.appendMessage(CDL, {
    conversationId: cdl.id,
    companyId: CDL,
    channel: 'dev_simulator',
    direction: 'inbound',
    role: 'customer',
    language: 'pt',
    content: 'cdl-secret',
    traces: [],
  })
  await store.appendMessage(ISO, {
    conversationId: iso.id,
    companyId: ISO,
    channel: 'dev_simulator',
    direction: 'inbound',
    role: 'customer',
    language: 'pt',
    content: 'iso-secret',
    traces: [],
  })

  const user = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signed = await user.auth.signInWithPassword({ email, password })
  assert.equal(signed.error, null, signed.error?.message)
  assert.ok(signed.data.session)

  const { data: memberships, error: memberError } = await user
    .from('company_memberships')
    .select('company_id, active')
    .eq('active', true)
  assert.equal(memberError, null, memberError?.message)
  const memberOf = new Set((memberships ?? []).map((row) => row.company_id))
  assert.equal(memberOf.has(CDL), true)
  assert.equal(memberOf.has(ISO), false)

  const own = await user
    .from('brasinha_conversations')
    .select('id, company_id')
    .eq('id', cdl.id)
    .maybeSingle()
  assert.equal(own.error, null, own.error?.message)
  assert.equal(own.data?.id, cdl.id)

  const foreign = await user
    .from('brasinha_conversations')
    .select('id, company_id')
    .eq('id', iso.id)
    .maybeSingle()
  assert.equal(foreign.data, null)

  const foreignMessages = await user
    .from('brasinha_messages')
    .select('id, content')
    .eq('conversation_id', iso.id)
  assert.equal((foreignMessages.data ?? []).length, 0)

  const spoofInsert = await user.from('brasinha_conversations').insert({
    company_id: ISO,
    channel: 'dev_simulator',
    language: 'pt',
    status: 'open',
    handoff_status: 'AI_ACTIVE',
  })
  assert.ok(spoofInsert.error, 'spoofed company insert must be blocked')

  const anon = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anonRead = await anon
    .from('brasinha_conversations')
    .select('id')
    .eq('id', cdl.id)
    .maybeSingle()
  assert.ok(!anonRead.data)
})

await test('CROSS_COMPANY_MESSAGE_PARENT_MISMATCH_BLOCKED', async () => {
  const email = process.env.CATERING_DEV_LOGIN_EMAIL?.trim()
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD?.trim()
  assert.ok(email, 'CATERING_DEV_LOGIN_EMAIL required')
  assert.ok(password, 'CATERING_DEV_LOGIN_PASSWORD required')

  const store = createSupabaseConversationStore(admin)
  const iso = await store.getOrCreate({
    companyId: ISO,
    channel: 'dev_simulator',
    language: 'pt',
    externalContactRef: 'brasinha-v1a1-parent-mismatch',
  })
  created.conversationIds.push(iso.id)

  const mismatch = {
    conversation_id: iso.id,
    company_id: CDL,
    channel: 'dev_simulator',
    direction: 'inbound',
    role: 'customer',
    language: 'pt',
    content: 'parent-mismatch-attack',
    traces: [],
  }

  const adminInsert = await admin.from('brasinha_messages').insert(mismatch)
  assert.ok(adminInsert.error, 'service role mismatch insert must be blocked by the database')
  assert.equal(adminInsert.error.code, '23503')

  const user = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signed = await user.auth.signInWithPassword({ email, password })
  assert.equal(signed.error, null, signed.error?.message)
  assert.ok(signed.data.session)

  const userInsert = await user.from('brasinha_messages').insert(mismatch)
  assert.ok(userInsert.error, 'company A JWT mismatch insert must be blocked by the database')
  assert.match(
    `${userInsert.error.code} ${userInsert.error.message}`,
    /23503|foreign key|brasinha_messages_conversation_company_fkey/i,
  )

  const leaked = await admin
    .from('brasinha_messages')
    .select('id')
    .eq('conversation_id', iso.id)
    .eq('content', 'parent-mismatch-attack')
  assert.equal((leaked.data ?? []).length, 0)
})

await test('SPOOFED_COMPANY_BLOCKED_IN_DEV_ROUTES', () => {
  const chat = source('app/api/dev/brasinha/chat/route.ts')
  const conversation = source('app/api/dev/brasinha/conversation/route.ts')
  const reset = source('app/api/dev/brasinha/reset/route.ts')
  for (const src of [chat, conversation, reset]) {
    assert.match(src, /rejectSpoofedCompanyId/)
    assert.match(src, /const companyId = resolveAuthorizedCompanyId\(auth\.session\)/)
    assert.doesNotMatch(src, /body\?\.companyId \|\|/)
  }
})

await cleanup().catch((error) => {
  console.error('cleanup_failed', error instanceof Error ? error.message : error)
})

console.log('')
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
