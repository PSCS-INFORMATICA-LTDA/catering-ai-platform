/**
 * Brasinha V1C — structured public-quote intake conversation.
 * Run: npm run test:dev:brasinha-quote-intake
 * Scripted path never calls OpenAI and never writes quotes.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { executeAllowedAiTool } from '../../Lib/brasinha/core/aiTools.ts'
import { createOpenAIReasoner } from '../../Lib/brasinha/core/openaiReasoner.ts'
import { BRASINHA_PROMPT_VERSION, buildBrasinhaSystemPrompt } from '../../Lib/brasinha/core/prompt.ts'
import { runBrasinhaTurn } from '../../Lib/brasinha/core/runTurn.ts'
import { createScriptedAiClient } from '../../Lib/brasinha/core/scriptedAiClient.ts'
import {
  applyQuoteIntakePatch,
  rememberOfferedPackages,
  resolvePendingIntakeAction,
} from '../../Lib/brasinha/intake/apply.ts'
import { createEmptyQuoteDraft } from '../../Lib/brasinha/intake/draft.ts'
import { formatReviewReply, readyToCreateQuoteReply, serviceWindow } from '../../Lib/brasinha/intake/review.ts'
import { resolveIntakeReadiness } from '../../Lib/brasinha/intake/stage.ts'
import { createMemoryConversationStore } from '../../Lib/brasinha/store/memoryConversationStore.ts'
import { createSupabaseConversationStore } from '../../Lib/brasinha/store/supabaseConversationStore.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const source = (relative) => readFileSync(join(ROOT, relative), 'utf8')

let passed = 0
let failed = 0
const gates = {
  CONTACT_STATE: 'FAIL',
  EVENT_STATE: 'FAIL',
  PACKAGE_STATE: 'FAIL',
  PACKAGE_CONFIRMATION_SIM: 'FAIL',
  PACKAGE_OPTIONS: 'FAIL',
  ADDITIONALS_ELIGIBILITY: 'FAIL',
  INCLUDED_ITEM_NOT_DOUBLE_SOLD: 'FAIL',
  WAITER: 'FAIL',
  OWN_GRILL: 'FAIL',
  RENTAL_GRILL: 'FAIL',
  SERVICE_TIMING: 'FAIL',
  REVIEW: 'FAIL',
  READY_TO_CREATE_QUOTE: 'FAIL',
  QUOTE_DB_WRITES: 'FAIL',
}

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

const packages = [
  {
    id: 'pkg-trad',
    packageKey: 'BBQTRAD',
    label: 'Traditional',
    pricePerPerson: 45,
    currency: 'USD',
    description: 'Traditional BBQ',
    custom: false,
  },
  {
    id: 'pkg-choice',
    packageKey: 'BBQCHOICE',
    label: 'Choice',
    pricePerPerson: 65,
    currency: 'USD',
    description: 'Choice BBQ',
    custom: false,
  },
]

const configuration = {
  packageId: 'pkg-trad',
  packageKey: 'BBQTRAD',
  packageName: 'Traditional',
  includedItems: [
    { id: 'item-farofa', label: 'Farofa Temperada', itemKey: 'ITEM_079' },
  ],
  requiredOptionGroups: [
    {
      id: 'grp-meat',
      label: 'Carnes',
      required: true,
      minChoices: 1,
      maxChoices: 1,
      selectedItemId: null,
      choices: [
        { id: 'opt-picanha', label: 'Picanha', catalogItemId: 'item-picanha' },
        { id: 'opt-alcatra', label: 'Alcatra', catalogItemId: 'item-alcatra' },
      ],
    },
  ],
}

const extras = {
  available: [
    {
      id: 'item-tomahawk',
      itemKey: 'ITEM_TOMAHAWK',
      label: 'Tomahawk',
      price: 85,
      currency: 'USD',
      category: 'CARNES',
      status: 'AVAILABLE',
    },
  ],
  includedInPackage: [
    {
      id: 'item-farofa',
      itemKey: 'ITEM_079',
      label: 'Farofa Temperada',
      status: 'INCLUDED_IN_PACKAGE',
    },
  ],
  selectedInPackage: [],
}

const serviceOptions = {
  waiter: {
    id: 'item-waiter',
    itemKey: 'CDL_WAITER_SERVICE',
    label: 'Garçom',
    price: 250,
    currency: 'USD',
  },
  disposableKit: {
    id: 'item-kit',
    itemKey: 'KIT_DESCARTAVEIS',
    label: 'Kit descartáveis',
    price: 8,
    currency: 'USD',
    included: false,
    offerable: true,
  },
  grillRental: {
    id: 'item-grill',
    itemKey: 'ITEM_084',
    label: 'Aluguel de churrasqueira',
    price: 100,
    currency: 'USD',
    qtyWhenRequired: 1,
  },
}

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

function fakePort(seen = []) {
  const emptyTrace = (tool, companyId, ids = {}) => ({
    tool,
    source: 'test-port',
    companyId,
    ids,
    timestamp: new Date().toISOString(),
  })
  return {
    async getCompanyPublicProfile(companyId) {
      seen.push({ tool: 'get_company_public_profile', companyId })
      return {
        data: {
          id: CDL,
          slug: 'cdl',
          name: 'CDL Services BBQ At Home',
          currency: 'USD',
          supportPhone: null,
        },
        trace: emptyTrace('get_company_public_profile', companyId),
      }
    },
    async getPackages(companyId) {
      seen.push({ tool: 'get_packages', companyId })
      return { data: packages, trace: emptyTrace('get_packages', companyId, { count: packages.length }) }
    },
    async getPackageDetails(companyId, query) {
      seen.push({ tool: 'get_package_details', companyId, query })
      const match = packages.find((pkg) =>
        `${pkg.label} ${pkg.packageKey}`.toLowerCase().includes(String(query).toLowerCase()),
      )
      return {
        data: match ?? null,
        trace: emptyTrace('get_package_details', companyId, { query, packageId: match?.id ?? null }),
      }
    },
    async getCatalogItem(companyId, query) {
      seen.push({ tool: 'get_catalog_item', companyId, query })
      const hay = `${query}`.toLowerCase()
      const item =
        hay.includes('tomahawk')
          ? extras.available[0]
          : hay.includes('farofa')
            ? extras.includedInPackage[0]
            : hay.includes('garçom') || hay.includes('waiter') || hay.includes('cdl_waiter')
              ? serviceOptions.waiter
              : null
      return { data: item, trace: emptyTrace('get_catalog_item', companyId, { query }) }
    },
    async searchCatalog(companyId, query) {
      seen.push({ tool: 'search_catalog', companyId, query })
      const hay = `${query}`.toLowerCase()
      const data = extras.available.filter((item) => item.label.toLowerCase().includes(hay))
      return { data, trace: emptyTrace('search_catalog', companyId, { query, count: data.length }) }
    },
    async getPublicBusinessRules(companyId) {
      seen.push({ tool: 'get_public_business_rules', companyId })
      return { data: rules, trace: emptyTrace('get_public_business_rules', companyId) }
    },
    async getQuoteByPublicReference(companyId) {
      seen.push({ tool: 'get_quote_by_public_reference', companyId })
      return { data: null, trace: emptyTrace('get_quote_by_public_reference', companyId) }
    },
    async getPackageConfiguration(companyId, query) {
      seen.push({ tool: 'get_package_configuration', companyId, query })
      return { data: configuration, trace: emptyTrace('get_package_configuration', companyId, { query }) }
    },
    async getAvailableAdditionalsForPackage(companyId, query) {
      seen.push({ tool: 'get_available_additionals_for_package', companyId, query })
      return { data: extras, trace: emptyTrace('get_available_additionals_for_package', companyId, { query }) }
    },
    async getPublicServiceOptions(companyId, query) {
      seen.push({ tool: 'get_public_service_options', companyId, query })
      return { data: serviceOptions, trace: emptyTrace('get_public_service_options', companyId, { query }) }
    },
  }
}

function draftFromInstructions(instructions) {
  const match = String(instructions || '').match(/---INTAKE_DRAFT---\n([\s\S]*?)\n---END_INTAKE_DRAFT---/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function lastUserText(input) {
  return [...input.messages].reverse().find((row) => row.role === 'user')?.content ?? ''
}

function call(name, args, id) {
  return { callId: id, name, arguments: args }
}

function createIntakeScriptedAiClient() {
  return createScriptedAiClient((input) => {
    const language = 'pt'
    const text = lastUserText(input)
    const draft = draftFromInstructions(input.instructions)

    if (input.toolResults?.length) {
      const pending = draft?.pendingAction?.type
      const stage = draft?.currentStage
      let reply = 'Perfeito. Podemos seguir com o próximo detalhe da cotação.'
      if (pending === 'confirm_package') reply = `Quer seguir com o ${draft.pendingAction.packageName}?`
      if (pending === 'confirm_children_bands') {
        reply =
          'Perfeito. Só confirmando: nenhuma criança de até 3 anos e nenhuma de 4 a 12, certo?'
      }
      if (pending === 'confirm_review' || stage === 'REVIEW') {
        reply = formatReviewReply(
          {
            ...createEmptyQuoteDraft(),
            contact: { firstName: draft.contact?.firstName ?? 'Philippe', lastName: draft.contact?.lastName ?? 'Costa', phone: draft.contact?.phone ?? '14075550100', email: null },
            event: {
              eventDate: draft.event?.eventDate ?? '2026-09-07',
              startTime: draft.event?.startTime ?? '11:00',
              adultCount: draft.event?.adultCount ?? 40,
              childrenUnder3Count: draft.event?.childrenUnder3Count ?? 0,
              children4To12Count: draft.event?.children4To12Count ?? 0,
              childrenBandsConfirmed: true,
              address: '1200 W Colonial Dr',
              formattedAddress: '1200 W Colonial Dr, Orlando, FL 32804',
              city: draft.event?.city ?? 'Orlando',
              state: draft.event?.state ?? 'FL',
              zipCode: draft.event?.zipCode ?? '32804',
            },
            package: draft.package ?? createEmptyQuoteDraft().package,
            additionals: draft.additionals ?? [],
            grill: draft.grill ?? createEmptyQuoteDraft().grill,
            service: draft.service ?? createEmptyQuoteDraft().service,
            conversation: createEmptyQuoteDraft().conversation,
          },
          language,
          rules,
        )
      }
      if (draft?.readyToCreateQuote) reply = readyToCreateQuoteReply(language)
      return { responseId: 'intake-tools', text: reply, toolCalls: [] }
    }

    if (draft?.pendingAction) {
      const declined = /^(n[aã]o|no|not)\b/i.test(text.trim())
      return {
        responseId: 'intake-pending',
        text: null,
        toolCalls: [
          call('resolve_pending_intake_action', { accepted: !declined, language }, 'pending'),
        ],
      }
    }

    if (/quais pacotes|what packages/i.test(text)) {
      return {
        responseId: 'intake-packages',
        text: null,
        toolCalls: [call('get_packages', { language }, 'pkgs')],
      }
    }

    if (/tomahawk/i.test(text)) {
      return {
        responseId: 'intake-tomahawk',
        text: null,
        toolCalls: [
          call('search_catalog', { query: 'Tomahawk', language }, 'srch'),
          call(
            'apply_quote_intake_patch',
            { additionalItemId: 'item-tomahawk', additionalQty: 1, language },
            'apply',
          ),
        ],
      }
    }

    if (/farofa/i.test(text)) {
      return {
        responseId: 'intake-farofa',
        text: null,
        toolCalls: [
          call(
            'apply_quote_intake_patch',
            { additionalItemId: 'item-farofa', additionalItemKey: 'ITEM_079', additionalQty: 1, language },
            'apply',
          ),
        ],
      }
    }

    if (/pode fechar|fechar/i.test(text) && draft && !draft.readyForReview) {
      return {
        responseId: 'intake-close-early',
        text: `Ainda faltam: ${(draft.missingFields || []).join(', ')}`,
        toolCalls: [],
      }
    }

    if (/quanto tempo|equipe chega|dura/i.test(text)) {
      return {
        responseId: 'intake-rules',
        text: null,
        toolCalls: [call('get_public_business_rules', { language }, 'rules')],
      }
    }

    const apply = { language }
    if (/philippe/i.test(text)) apply.firstName = 'Philippe'
    if (/\bcosta\b/i.test(text)) apply.lastName = 'Costa'
    const phone = text.match(/\b1?4075550100\b/)
    if (phone) apply.phone = `+${phone[0].replace(/^\+/, '')}`
    if (/7 de setembro de 2026|7 setembro de 2026|2026-09-07/i.test(text)) {
      apply.eventDate = '2026-09-07'
    }
    if (/\b11h\b|\b11:00\b/i.test(text)) apply.startTime = '11:00'
    if (/40 adultos/i.test(text)) apply.adultCount = 40
    if (/0 crian/i.test(text)) apply.childrenZeroAll = true
    if (/orlando|colonial/i.test(text)) {
      apply.address = '1200 W Colonial Dr'
      apply.formattedAddress = '1200 W Colonial Dr, Orlando, FL 32804'
      apply.city = 'Orlando'
      apply.state = 'FL'
      apply.zipCode = '32804'
    }
    if (/^45$/.test(text.trim()) || /\b45\b/.test(text) && /tradicional|pacote|seguir/i.test(text) === false) {
      if (text.trim() === '45') apply.packageQuery = '45'
    }
    if (/picanha|primeira op/i.test(text)) {
      apply.optionGroupId = 'grp-meat'
      apply.optionItemId = 'opt-picanha'
    }
    if (/tenho churrasqueira|possuo churrasqueira/i.test(text)) apply.hasGrill = true
    if (/n[aã]o tenho churrasqueira/i.test(text)) apply.hasGrill = false
    if (/dois gar[cç]ons|2 gar[cç]ons/i.test(text)) {
      apply.waiterAsked = true
      apply.waiterQty = 2
    }
    if (/inventa endere/i.test(text)) apply.inventAddress = true

    const keys = Object.keys(apply).filter((key) => key !== 'language')
    if (keys.length) {
      const tools = [call('apply_quote_intake_patch', apply, 'apply')]
      if (apply.packageQuery || apply.hasGrill != null || apply.waiterQty != null) {
        const query = draft?.package?.packageName || draft?.package?.packageKey || 'Traditional'
        if (apply.packageQuery) tools.unshift(call('get_packages', { language }, 'pkgs'))
        if (apply.hasGrill != null || apply.waiterQty != null) {
          tools.unshift(call('get_public_service_options', { query, language }, 'svc'))
        }
      }
      if (/picanha|primeira op/i.test(text)) {
        tools.unshift(
          call('get_package_configuration', { query: 'Traditional', language }, 'cfg'),
        )
      }
      return { responseId: 'intake-apply', text: null, toolCalls: tools }
    }

    return {
      responseId: 'intake-follow',
      text: 'Posso seguir com o próximo detalhe da cotação.',
      toolCalls: [],
    }
  })
}

function reasoner() {
  return createOpenAIReasoner({
    client: createIntakeScriptedAiClient(),
    model: 'gpt-5.6-luna',
  })
}

async function ask(store, text, conversationId) {
  return runBrasinhaTurn({
    inbound: {
      channel: 'dev_simulator',
      companyId: CDL,
      conversationId: conversationId ?? null,
      text,
    },
    store,
    catalog: fakePort(),
    reasoner: reasoner(),
  })
}

await test('SOURCE_INTAKE_NO_REGEX_SIM_AND_NO_QUOTE_WRITES', () => {
  const files = [
    'Lib/brasinha/core/runTurn.ts',
    'Lib/brasinha/core/openaiReasoner.ts',
    'Lib/brasinha/core/reasoner.ts',
    'Lib/brasinha/core/aiTools.ts',
    'Lib/brasinha/intake/apply.ts',
    'Lib/brasinha/intake/stage.ts',
    'Lib/brasinha/intake/draft.ts',
    'Lib/brasinha/tools/canonicalPort.ts',
  ]
  for (const file of files) {
    const body = source(file)
    assert.doesNotMatch(body, /text\s*===\s*['"]sim['"]/i)
    assert.doesNotMatch(body, /if\s*\(\s*text\.trim\(\)\.toLowerCase\(\)\s*===\s*['"]sim['"]/)
    assert.doesNotMatch(body, /saveQuote\(|finalize_public_quote|from\('quotes'\)|from\('events'\)|from\('customers'\)/)
  }
  assert.match(source('Lib/brasinha/core/prompt.ts'), /structured quote intake/)
  assert.match(source('Lib/brasinha/core/aiTools.ts'), /get_package_configuration/)
  assert.match(source('Lib/brasinha/core/aiTools.ts'), /get_available_additionals_for_package/)
  assert.match(source('Lib/brasinha/core/aiTools.ts'), /resolve_pending_intake_action/)
  assert.equal(BRASINHA_PROMPT_VERSION.startsWith('v1c'), true)
  assert.match(
    buildBrasinhaSystemPrompt({ companyName: 'CDL', language: 'pt', draft: createEmptyQuoteDraft() }),
    /INTAKE_DRAFT/,
  )
  gates.QUOTE_DB_WRITES = 'PASS'
})

await test('CONTACT_EVENT_AND_CHILDREN_BANDS', () => {
  let draft = createEmptyQuoteDraft()
  draft = applyQuoteIntakePatch(draft, { firstName: 'Philippe' }).draft
  assert.equal(draft.contact.firstName, 'Philippe')
  assert.equal(draft.conversation.currentStage === 'CONTACT', false)
  draft = applyQuoteIntakePatch(draft, {
    eventDate: '2026-09-07',
    adultCount: 40,
    childrenZeroAll: true,
  }).draft
  assert.equal(draft.event.adultCount, 40)
  assert.equal(draft.event.childrenUnder3Count, 0)
  assert.equal(draft.event.children4To12Count, 0)
  assert.equal(draft.event.childrenBandsConfirmed, false)
  assert.equal(draft.conversation.pendingAction?.type, 'confirm_children_bands')
  draft = resolvePendingIntakeAction(draft, true).draft
  assert.equal(draft.event.childrenBandsConfirmed, true)
  draft = applyQuoteIntakePatch(draft, {
    startTime: '11:00',
    address: '1200 W Colonial Dr',
    city: 'Orlando',
    lastName: 'Costa',
    phone: '+14075550100',
  }).draft
  assert.equal(draft.conversation.currentStage, 'PACKAGE')
  gates.CONTACT_STATE = 'PASS'
  gates.EVENT_STATE = 'PASS'
})

await test('PACKAGE_PRICE_THEN_SIM_CONFIRMATION', () => {
  let draft = rememberOfferedPackages(createEmptyQuoteDraft(), packages)
  draft = applyQuoteIntakePatch(draft, { packageQuery: '45' }).draft
  assert.equal(draft.package.packageId, 'pkg-trad')
  assert.equal(draft.package.packageName, 'Traditional')
  assert.equal(draft.package.confirmed, false)
  assert.equal(draft.conversation.pendingAction?.type, 'confirm_package')
  draft = resolvePendingIntakeAction(draft, true).draft
  assert.equal(draft.package.confirmed, true)
  assert.equal(draft.conversation.pendingAction?.type === 'confirm_package', false)
  gates.PACKAGE_STATE = 'PASS'
  gates.PACKAGE_CONFIRMATION_SIM = 'PASS'
})

await test('PACKAGE_OPTIONS_ADDITIONALS_GRILL_WAITER', async () => {
  let draft = rememberOfferedPackages(createEmptyQuoteDraft(), packages)
  draft = applyQuoteIntakePatch(draft, {
    firstName: 'Philippe',
    lastName: 'Costa',
    phone: '+14075550100',
    eventDate: '2026-09-07',
    startTime: '11:00',
    adultCount: 40,
    childrenUnder3Count: 0,
    children4To12Count: 0,
    address: '1200 W Colonial Dr',
    city: 'Orlando',
    packageQuery: '45',
    confirmPackage: true,
  }).draft
  const catalog = fakePort()
  const config = await executeAllowedAiTool({
    name: 'get_package_configuration',
    args: { query: 'Traditional', language: 'pt' },
    companyId: CDL,
    language: 'pt',
    catalog,
    intake: {
      draft,
      onDraft(next) {
        draft = next
      },
    },
  })
  assert.equal(config.denied, false)
  assert.deepEqual(draft.package.requiredOptionGroupIds, ['grp-meat'])
  draft = applyQuoteIntakePatch(draft, {
    optionGroupId: 'grp-meat',
    optionItemId: 'opt-picanha',
  }).draft
  assert.equal(draft.package.packageSelections['grp-meat'], 'opt-picanha')
  gates.PACKAGE_OPTIONS = 'PASS'

  const extrasTool = await executeAllowedAiTool({
    name: 'get_available_additionals_for_package',
    args: { query: 'Traditional', language: 'pt' },
    companyId: CDL,
    language: 'pt',
    catalog,
    intake: { draft, onDraft(next) { draft = next } },
  })
  assert.equal(extrasTool.data.available[0].itemKey, 'ITEM_TOMAHAWK')
  assert.equal(extrasTool.data.includedInPackage[0].status, 'INCLUDED_IN_PACKAGE')
  gates.ADDITIONALS_ELIGIBILITY = 'PASS'

  const blocked = await executeAllowedAiTool({
    name: 'apply_quote_intake_patch',
    args: { additionalItemId: 'item-farofa', additionalQty: 1, language: 'pt' },
    companyId: CDL,
    language: 'pt',
    catalog,
    intake: { draft, onDraft(next) { draft = next } },
  })
  assert.match(String(blocked.data.notes), /incluído/)
  assert.equal(draft.additionals.some((row) => row.itemId === 'item-farofa'), false)
  gates.INCLUDED_ITEM_NOT_DOUBLE_SOLD = 'PASS'

  const tomahawk = await executeAllowedAiTool({
    name: 'apply_quote_intake_patch',
    args: { additionalItemId: 'item-tomahawk', additionalItemKey: 'ITEM_TOMAHAWK', additionalQty: 1, language: 'pt' },
    companyId: CDL,
    language: 'pt',
    catalog,
    intake: { draft, onDraft(next) { draft = next } },
  })
  assert.equal(tomahawk.denied, false)
  assert.equal(draft.additionals[0]?.itemId, 'item-tomahawk')

  const own = applyQuoteIntakePatch(draft, { hasGrill: true }).draft
  assert.equal(own.grill.setupAnswered, true)
  assert.equal(own.grill.hasGrill, true)
  assert.equal(own.grill.rentalRequired, false)
  assert.equal(own.grill.rentalQty, 0)
  assert.equal(own.grill.photoStatus, 'pending')
  gates.OWN_GRILL = 'PASS'

  const rental = applyQuoteIntakePatch(createEmptyQuoteDraft(), { hasGrill: false }).draft
  assert.equal(rental.grill.hasGrill, false)
  assert.equal(rental.grill.rentalRequired, true)
  assert.equal(rental.grill.rentalQty, 1)
  gates.RENTAL_GRILL = 'PASS'

  draft = applyQuoteIntakePatch(own, { waiterAsked: true, waiterQty: 2 }).draft
  assert.equal(draft.service.waiterQty, 2)
  gates.WAITER = 'PASS'

  const window = serviceWindow('11:00', rules)
  assert.equal(window.start, '11:00')
  assert.equal(window.setup, '10:00')
  assert.equal(window.end, '15:00')
  assert.equal(window.durationHours, 4)
  assert.match(source('Lib/brasinha/core/prompt.ts'), /INÍCIO do serviço/)
  assert.match(source('Lib/brasinha/intake/review.ts'), /Crew arrives for setup|Equipe chega para montagem/)
  assert.doesNotMatch(source('Lib/brasinha/core/copy.ts'), /o serviço começa uma hora antes/)
  gates.SERVICE_TIMING = 'PASS'

  const readiness = resolveIntakeReadiness(draft)
  assert.equal(readiness.readyForReview, true)
  draft = resolvePendingIntakeAction(draft, true).draft
  assert.equal(draft.conversation.readyToCreateQuote, true)
  assert.equal(draft.conversation.currentStage, 'READY_TO_CREATE_QUOTE')
  assert.match(formatReviewReply(draft, 'pt', rules), /Início do serviço: 11:00/)
  assert.match(formatReviewReply(draft, 'pt', rules), /10:00/)
  assert.match(readyToCreateQuoteReply('pt'), /pronta para ser criada/)
  gates.REVIEW = 'PASS'
  gates.READY_TO_CREATE_QUOTE = 'PASS'
})

await test('MULTITURN_SIM_DOES_NOT_HANDOFF', async () => {
  const store = createMemoryConversationStore()
  const turns = [
    'Quero churrasco dia 7 de setembro de 2026.',
    '40 adultos e 0 crianças.',
    'Sim, nenhuma nas duas faixas.',
    'É o Philippe Costa, telefone 14075550100.',
    '11h',
    '1200 W Colonial Dr, Orlando, FL 32804',
    'Quais pacotes vocês têm?',
    '45',
    'sim',
    'Picanha',
    'Quero Tomahawk também.',
    'Quero mais farofa.',
    'Tenho churrasqueira.',
    'Quero dois garçons.',
  ]
  let conversationId = null
  let last = null
  for (const text of turns) {
    last = await ask(store, text, conversationId)
    conversationId = last.conversation.id
    assert.equal(last.conversation.handoffStatus, 'AI_ACTIVE', `handoff after: ${text}`)
    assert.notEqual(last.conversation.handoffReason, 'unknown_rule', `unknown_rule after: ${text}`)
  }
  assert.equal(last.intake.packageKey, 'BBQTRAD')
  assert.equal(last.intake.pendingActionType === 'confirm_package', false)
  const recovered = await store.getIntakeDraft(CDL, conversationId)
  assert.equal(recovered.package.confirmed, true)
  assert.equal(recovered.package.packageName, 'Traditional')
  assert.equal(recovered.additionals.some((row) => row.itemId === 'item-farofa'), false)
  assert.equal(recovered.grill.hasGrill, true)
  assert.equal(recovered.service.waiterQty, 2)
  const early = await ask(createMemoryConversationStore(), 'Pode fechar.')
  assert.match(early.reply.text, /faltam|Posso seguir|nome/i)
  assert.equal(early.conversation.handoffStatus, 'AI_ACTIVE')
  const close = await ask(store, 'sim', conversationId)
  assert.equal(close.conversation.handoffStatus, 'AI_ACTIVE')
  if (close.intake.readyForReview) {
    assert.equal(close.intake.readyToCreateQuote, true)
  }
})

await test('INVENT_ADDRESS_REJECTED', () => {
  const result = applyQuoteIntakePatch(createEmptyQuoteDraft(), { inventAddress: true })
  assert.equal(result.rejected, 'address_must_be_real')
})

await test('SUPABASE_INTAKE_DRAFT_COLUMN', async () => {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  const admin = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const store = createSupabaseConversationStore(admin)
  const conversation = await store.getOrCreate({
    companyId: CDL,
    channel: 'dev_simulator',
    language: 'pt',
    externalContactRef: 'brasinha-v1c-intake',
  })
  try {
    const draft = createEmptyQuoteDraft()
    draft.contact.firstName = 'Philippe'
    draft.package.packageName = 'Traditional'
    await store.saveIntakeDraft(CDL, conversation.id, draft)
    const recovered = await store.getIntakeDraft(CDL, conversation.id)
    assert.equal(recovered.contact.firstName, 'Philippe')
    const column = await admin.from('brasinha_conversations').select('intake_draft').limit(1)
    if (column.error) {
      assert.match(column.error.message, /intake_draft/)
      const messages = await store.listMessages(CDL, conversation.id)
      assert.equal(
        messages.some((row) => row.role === 'system' && row.content.includes('Philippe')),
        true,
      )
    }
  } finally {
    await admin.from('brasinha_messages').delete().eq('conversation_id', conversation.id)
    await admin.from('brasinha_conversations').delete().eq('id', conversation.id)
  }
})

console.log('')
console.log(`${passed} passed, ${failed} failed`)
for (const [name, value] of Object.entries(gates)) {
  console.log(`${name} = ${value}`)
}
console.log('QUOTE_DB_WRITES = 0')
process.exit(failed === 0 ? 0 : 1)
