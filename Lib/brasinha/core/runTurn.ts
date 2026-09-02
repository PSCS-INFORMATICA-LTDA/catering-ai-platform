import { detectBrasinhaLanguage } from '../language.ts'
import { getCompanyPersona, personaIntro } from '../persona.ts'
import {
  deniedReply,
  evaluateBrasinhaPolicy,
  handoffReply,
} from '../policy.ts'
import type { ConversationStore } from '../store/memoryConversationStore.ts'
import type { BrasinhaCatalogPort } from '../tools/types.ts'
import { BLOCKED_WRITE_TOOLS } from '../tools/types.ts'
import type {
  BrasinhaLanguage,
  BrasinhaToolTrace,
  BrasinhaTurnResult,
  InboundMessage,
} from '../types.ts'
import {
  catalogReply,
  grillReply,
  packageDetailsReply,
  packagesReply,
  quoteIntentReply,
  quoteStatusReply,
  rulesReply,
  waiterReply,
} from './copy.ts'
import {
  detectBrasinhaIntent,
  extractGuestCount,
  extractPackageQuery,
} from './intent.ts'

function blockedToolTrace(
  tool: (typeof BLOCKED_WRITE_TOOLS)[number],
  companyId: string,
  reason: string,
): BrasinhaToolTrace {
  return {
    tool,
    source: 'Lib/brasinha/policy',
    companyId,
    ids: {},
    timestamp: new Date().toISOString(),
    denied: true,
    reason,
  }
}

export async function runBrasinhaTurn(input: {
  inbound: InboundMessage
  store: ConversationStore
  catalog: BrasinhaCatalogPort
}): Promise<BrasinhaTurnResult> {
  const companyId = input.inbound.companyId.trim()
  if (!companyId) {
    throw new Error('company_id_required')
  }

  const language = detectBrasinhaLanguage(
    input.inbound.text,
    input.inbound.languageHint ?? 'pt',
  )
  const conversation = input.store.getOrCreate({
    companyId,
    conversationId: input.inbound.conversationId,
    channel: input.inbound.channel,
    language,
    externalContactRef: input.inbound.externalContactRef,
  })
  conversation.language = language

  input.store.appendMessage(companyId, {
    conversationId: conversation.id,
    companyId,
    channel: input.inbound.channel,
    direction: 'inbound',
    role: 'customer',
    language,
    content: input.inbound.text,
    traces: [],
  })

  const policy = evaluateBrasinhaPolicy(input.inbound.text)
  const traces: BrasinhaToolTrace[] = []
  let text: string
  let toolsCalled: string[] = []

  if (policy.action === 'deny') {
    traces.push(blockedToolTrace('approve_discount', companyId, policy.reason))
    if (policy.capability === 'confirm_payment' || policy.capability === 'take_payment') {
      traces[0] = blockedToolTrace('mark_payment_paid', companyId, policy.reason)
    }
    if (policy.capability === 'alter_prices') {
      traces[0] = blockedToolTrace('alter_price', companyId, policy.reason)
    }
    text = deniedReply(language, policy.capability)
    input.store.setHandoff(
      companyId,
      conversation.id,
      'HUMAN_REVIEW_REQUIRED',
      policy.reason,
    )
  } else if (policy.action === 'handoff') {
    text = handoffReply(language)
    input.store.setHandoff(
      companyId,
      conversation.id,
      'HUMAN_REVIEW_REQUIRED',
      policy.reason,
    )
  } else {
    const answer = await answerIntent({
      companyId,
      language,
      text: input.inbound.text,
      catalog: input.catalog,
    })
    text = answer.text
    traces.push(...answer.traces)
    toolsCalled = answer.toolsCalled
    if (answer.handoff) {
      input.store.setHandoff(
        companyId,
        conversation.id,
        'HUMAN_REVIEW_REQUIRED',
        answer.handoff,
      )
    }
  }

  const updated = input.store.get(companyId, conversation.id) ?? conversation
  const createdAt = new Date().toISOString()
  const reply = {
    channel: input.inbound.channel,
    companyId,
    conversationId: conversation.id,
    language,
    text,
    handoffStatus: updated.handoffStatus,
    createdAt,
  }

  input.store.appendMessage(companyId, {
    conversationId: conversation.id,
    companyId,
    channel: input.inbound.channel,
    direction: 'outbound',
    role: 'assistant',
    language,
    content: text,
    traces,
    createdAt,
  })

  return {
    conversation: updated,
    reply,
    traces,
    detectedLanguage: language,
    toolsCalled,
  }
}

async function answerIntent(input: {
  companyId: string
  language: BrasinhaLanguage
  text: string
  catalog: BrasinhaCatalogPort
}): Promise<{
  text: string
  traces: BrasinhaToolTrace[]
  toolsCalled: string[]
  handoff: string | null
}> {
  const persona = getCompanyPersona(input.companyId)
  const intent = detectBrasinhaIntent(input.text)
  const traces: BrasinhaToolTrace[] = []
  const toolsCalled: string[] = []

  if (intent === 'list_packages') {
    const packages = await input.catalog.getPackages(input.companyId, input.language)
    traces.push(packages.trace)
    toolsCalled.push(packages.trace.tool)
    return {
      text: `${personaIntro(input.language, persona)}\n\n${packagesReply(input.language, packages.data)}`,
      traces,
      toolsCalled,
      handoff: packages.data.length ? null : 'unknown_rule',
    }
  }

  if (intent === 'package_details') {
    const query = extractPackageQuery(input.text)
    const details = await input.catalog.getPackageDetails(
      input.companyId,
      query,
      input.language,
    )
    traces.push(details.trace)
    toolsCalled.push(details.trace.tool)
    const body = packageDetailsReply(input.language, details.data)
    return {
      text: body ?? handoffReply(input.language),
      traces,
      toolsCalled,
      handoff: body ? null : 'unknown_rule',
    }
  }

  if (intent === 'grill_rental' || intent === 'waiter' || intent === 'public_rules') {
    const rules = await input.catalog.getPublicBusinessRules(input.companyId)
    traces.push(rules.trace)
    toolsCalled.push(rules.trace.tool)
    if (intent === 'grill_rental') {
      const grill = await input.catalog.getCatalogItem(
        input.companyId,
        'ITEM_084',
        input.language,
      )
      traces.push(grill.trace)
      toolsCalled.push(grill.trace.tool)
      return {
        text: grillReply(
          input.language,
          grill.data?.price ?? rules.data.grillRentalFee,
        ),
        traces,
        toolsCalled,
        handoff: null,
      }
    }
    if (intent === 'waiter') {
      const waiter = await input.catalog.getCatalogItem(
        input.companyId,
        'CDL_WAITER_SERVICE',
        input.language,
      )
      traces.push(waiter.trace)
      toolsCalled.push(waiter.trace.tool)
      return {
        text: waiterReply(
          input.language,
          rules.data.waiterServiceFee,
          waiter.data,
        ),
        traces,
        toolsCalled,
        handoff: waiter.data?.price == null && !rules.data.waiterServiceFee
          ? 'unknown_rule'
          : null,
      }
    }
    return {
      text: rulesReply(input.language, rules.data),
      traces,
      toolsCalled,
      handoff: null,
    }
  }

  if (intent === 'catalog_search') {
    const hits = await input.catalog.searchCatalog(
      input.companyId,
      input.text,
      input.language,
    )
    traces.push(hits.trace)
    toolsCalled.push(hits.trace.tool)
    const body = catalogReply(input.language, hits.data)
    return {
      text: body || handoffReply(input.language),
      traces,
      toolsCalled,
      handoff: body ? null : 'unknown_rule',
    }
  }

  if (intent === 'quote_status') {
    const reference = input.text.match(/Q-\d{4}-\d+/i)?.[0] ?? ''
    const found = await input.catalog.getQuoteByPublicReference(
      input.companyId,
      reference,
    )
    traces.push(found.trace)
    toolsCalled.push(found.trace.tool)
    return {
      text: quoteStatusReply(input.language, found.data),
      traces,
      toolsCalled,
      handoff: found.data ? null : 'unknown_rule',
    }
  }

  if (intent === 'quote_intent') {
    traces.push({
      tool: 'create_quote_draft',
      source: 'blocked:canonical_submit_not_reused',
      companyId: input.companyId,
      ids: {},
      timestamp: new Date().toISOString(),
      denied: true,
      reason: 'write_not_implemented',
    })
    toolsCalled.push('create_quote_draft')
    return {
      text: quoteIntentReply(input.language, extractGuestCount(input.text)),
      traces,
      toolsCalled,
      handoff: null,
    }
  }

  return {
    text: handoffReply(input.language),
    traces,
    toolsCalled,
    handoff: 'unknown_rule',
  }
}
