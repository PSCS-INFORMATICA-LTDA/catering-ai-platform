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
import { extraHourHandoffReply } from './copy.ts'
import { selectConversationHistory } from './history.ts'
import { detectBrasinhaIntent } from './intent.ts'
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
  let reasonerModel: string | null = null
  let providerFailure = false
  let providerErrorStatus: string | null = null
  let providerErrorCode: string | null = null
  let providerErrorType: string | null = null

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
  } else if (detectBrasinhaIntent(input.inbound.text) === 'extra_service_hour') {
    text = extraHourHandoffReply(language)
    await input.store.setHandoff(
      companyId,
      conversation.id,
      'HUMAN_REVIEW_REQUIRED',
      'extra_service_hour',
    )
  } else {
    const stored = await input.store.listMessages(companyId, conversation.id)
    const answer = await reasoner.answer({
      companyId,
      language,
      text: input.inbound.text,
      catalog: input.catalog,
      history: selectConversationHistory(stored, { excludeLastInbound: true }),
    })
    text = answer.text
    traces.push(...answer.traces)
    toolsCalled = answer.toolsCalled
    reasonerModel = answer.model ?? null
    providerFailure = Boolean(answer.providerFailure)
    providerErrorStatus = answer.providerErrorStatus ?? null
    providerErrorCode = answer.providerErrorCode ?? null
    providerErrorType = answer.providerErrorType ?? null
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
    reasonerKind: reasoner.kind,
    reasonerModel,
    providerFailure,
    providerErrorStatus,
    providerErrorCode,
    providerErrorType,
  }
}
