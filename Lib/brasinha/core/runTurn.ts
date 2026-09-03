import { detectBrasinhaLanguage } from '../language.ts'
import {
  deniedReply,
  evaluateBrasinhaPolicy,
  handoffReply,
} from '../policy.ts'
import type { ConversationStore } from '../store/types.ts'
import type { BrasinhaCatalogPort } from '../tools/types.ts'
import { BLOCKED_WRITE_TOOLS } from '../tools/types.ts'
import type {
  BrasinhaLanguage,
  BrasinhaToolTrace,
  BrasinhaTurnResult,
  InboundMessage,
} from '../types.ts'
import {
  createDeterministicReasoner,
  type BrasinhaReasoner,
} from './reasoner.ts'

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
  reasoner?: BrasinhaReasoner
}): Promise<BrasinhaTurnResult> {
  const companyId = input.inbound.companyId.trim()
  if (!companyId) {
    throw new Error('company_id_required')
  }

  const language = detectBrasinhaLanguage(
    input.inbound.text,
    input.inbound.languageHint ?? 'pt',
  )
  const conversation = await input.store.getOrCreate({
    companyId,
    conversationId: input.inbound.conversationId,
    channel: input.inbound.channel,
    language,
    externalContactRef: input.inbound.externalContactRef,
  })
  conversation.language = language

  await input.store.appendMessage(companyId, {
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
  const reasoner = input.reasoner ?? createDeterministicReasoner()

  if (policy.action === 'deny') {
    traces.push(blockedToolTrace('approve_discount', companyId, policy.reason))
    if (policy.capability === 'confirm_payment' || policy.capability === 'take_payment') {
      traces[0] = blockedToolTrace('mark_payment_paid', companyId, policy.reason)
    }
    if (policy.capability === 'alter_prices') {
      traces[0] = blockedToolTrace('alter_price', companyId, policy.reason)
    }
    text = deniedReply(language, policy.capability)
    await input.store.setHandoff(
      companyId,
      conversation.id,
      'HUMAN_REVIEW_REQUIRED',
      policy.reason,
    )
  } else if (policy.action === 'handoff') {
    text = handoffReply(language)
    await input.store.setHandoff(
      companyId,
      conversation.id,
      'HUMAN_REVIEW_REQUIRED',
      policy.reason,
    )
  } else {
    const answer = await reasoner.answer({
      companyId,
      language,
      text: input.inbound.text,
      catalog: input.catalog,
    })
    text = answer.text
    traces.push(...answer.traces)
    toolsCalled = answer.toolsCalled
    if (answer.handoff) {
      await input.store.setHandoff(
        companyId,
        conversation.id,
        'HUMAN_REVIEW_REQUIRED',
        answer.handoff,
      )
    }
  }

  const updated = (await input.store.get(companyId, conversation.id)) ?? conversation
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

  await input.store.appendMessage(companyId, {
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
