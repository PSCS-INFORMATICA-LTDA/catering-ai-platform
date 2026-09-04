import { handoffReply } from '../policy.ts'
import type { BrasinhaStoredMessage, BrasinhaToolTrace } from '../types.ts'
import type { BrasinhaAiClient, BrasinhaAiToolCall } from './aiClient.ts'
import { createOpenAISdkClient } from './aiClient.ts'
import {
  ALLOWED_AI_TOOLS,
  BRASINHA_AI_TOOL_DEFINITIONS,
  executeAllowedAiTool,
  serializeToolResult,
} from './aiTools.ts'
import { historyToAiMessages } from './history.ts'
import {
  collectCanonicalAmounts,
  replyInventedPrice,
  unapprovedMentionedAmounts,
} from './priceGuard.ts'
import { createEmptyQuoteDraft, type BrasinhaQuoteDraft } from '../intake/draft.ts'
import {
  formatReviewReply,
  nextIntakePrompt,
  readyToCreateQuoteReply,
} from '../intake/review.ts'
import { detectSocialTurn, extractCustomerName } from './social.ts'
import { socialReply } from './copy.ts'
import { buildBrasinhaSystemPrompt } from './prompt.ts'
import { classifyProviderError } from './providerError.ts'
import {
  createDeterministicReasoner,
  type BrasinhaReasoner,
  type BrasinhaReasonerInput,
  type BrasinhaReasonerResult,
} from './reasoner.ts'

const MAX_TOOL_ROUNDS = 6

export type OpenAIReasonerOptions = {
  client?: BrasinhaAiClient
  model?: string
  fallback?: BrasinhaReasoner
  env?: Record<string, string | undefined>
}

function auditTrace(
  companyId: string,
  model: string,
  reason?: string,
  classified?: { status: string | null; code: string; type: string | null },
  extras?: Record<string, string | number | null>,
): BrasinhaToolTrace {
  return {
    tool: 'ai_reasoner',
    source: 'Lib/brasinha/core/openaiReasoner',
    companyId,
    ids: {
      provider: 'openai',
      model,
      provider_error_status: classified?.status ?? null,
      provider_error_code: classified?.code ?? null,
      provider_error_type: classified?.type ?? null,
      ...extras,
    },
    timestamp: new Date().toISOString(),
    denied: Boolean(reason),
    reason,
  }
}

async function answerWithOpenAI(
  input: BrasinhaReasonerInput & { history?: BrasinhaStoredMessage[] },
  client: BrasinhaAiClient,
  model: string,
): Promise<BrasinhaReasonerResult> {
  const traces: BrasinhaToolTrace[] = []
  const toolsCalled: string[] = []
  const executions: Array<{ name: string; data: unknown }> = []
  const allowedAmounts: number[] = []
  const intake = {
    draft: input.draft ?? createEmptyQuoteDraft(),
    onDraft(next: BrasinhaQuoteDraft) {
      intake.draft = next
      input.onDraft?.(next)
    },
  }

  const profile = await input.catalog.getCompanyPublicProfile(
    input.companyId,
    input.language,
  )
  traces.push({
    ...profile.trace,
    reason: 'prompt_company_context',
  })

  const messages = [
    ...historyToAiMessages(input.history ?? []),
    { role: 'user' as const, content: input.text },
  ]

  let pendingCalls: BrasinhaAiToolCall[] = []
  let toolResults: Array<{ callId: string; name: string; output: string }> = []
  let text = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const instructions = buildBrasinhaSystemPrompt({
      companyName: profile.data?.name ?? null,
      language: input.language,
      draft: intake.draft,
    })
    const completion = await client.complete({
      model,
      instructions,
      messages,
      tools: BRASINHA_AI_TOOL_DEFINITIONS,
      pendingCalls,
      toolResults,
    })

    if (completion.toolCalls.length) {
      pendingCalls = completion.toolCalls
      toolResults = []
      for (const call of completion.toolCalls) {
        const executed = await executeAllowedAiTool({
          name: call.name,
          args: call.arguments,
          companyId: input.companyId,
          language: input.language,
          catalog: input.catalog,
          intake,
        })
        traces.push(executed.trace)
        if ((ALLOWED_AI_TOOLS as readonly string[]).includes(executed.name)) {
          toolsCalled.push(executed.name)
        }
        executions.push({ name: executed.name, data: executed.data })
        allowedAmounts.push(...collectCanonicalAmounts([executed.data]))
        toolResults.push({
          callId: call.callId,
          name: executed.name,
          output: serializeToolResult(executed),
        })
      }
      continue
    }

    text = completion.text?.trim() || ''
    break
  }

  const invented = Boolean(text) && replyInventedPrice(text, allowedAmounts)
  const pending = intake.draft.conversation.pendingAction
  const social = detectSocialTurn(input.text)
  if (invented) {
    const unapproved = unapprovedMentionedAmounts(text, allowedAmounts)
    traces.push(
      auditTrace(input.companyId, model, 'price_not_canonical', undefined, {
        unapproved_amounts: unapproved.length ? unapproved.join(',') : null,
      }),
    )
    return {
      text: handoffReply(input.language),
      traces,
      toolsCalled,
      handoff: 'price_not_canonical',
      provider: 'openai',
      model,
      draft: intake.draft,
    }
  }
  if (!text) {
    text =
      social && !pending
        ? socialReply(input.language, social, extractCustomerName(input.text), input.text)
        : intakeFallbackReply(intake.draft, input.language)
  }

  traces.push(auditTrace(input.companyId, model))

  return {
    text,
    traces,
    toolsCalled,
    handoff: null,
    provider: 'openai',
    model,
    draft: intake.draft,
  }
}

function intakeFallbackReply(draft: BrasinhaQuoteDraft, language: BrasinhaReasonerInput['language']) {
  if (draft.conversation.readyToCreateQuote) return readyToCreateQuoteReply(language)
  if (draft.conversation.readyForReview || draft.conversation.currentStage === 'REVIEW') {
    return formatReviewReply(draft, language, null)
  }
  return nextIntakePrompt(draft, language)
}

export function createOpenAIReasoner(
  options: OpenAIReasonerOptions = {},
): BrasinhaReasoner {
  const env = options.env ?? process.env
  const model = options.model ?? env.BRASINHA_OPENAI_MODEL?.trim() ?? 'gpt-5.6-luna'
  const fallback = options.fallback ?? createDeterministicReasoner()
  const client = options.client

  return {
    kind: 'openai',
    async answer(input) {
      try {
        const resolved = client ?? createOpenAISdkClient(env)
        return await answerWithOpenAI(input, resolved, model)
      } catch (error) {
        const classified = classifyProviderError(error)
        const recovered = await fallback.answer(input)
        return {
          ...recovered,
          traces: [
            auditTrace(input.companyId, model, 'provider_failure', classified),
            ...recovered.traces,
          ],
          toolsCalled: recovered.toolsCalled,
          provider: recovered.provider ?? 'deterministic',
          model: recovered.model ?? model,
          providerFailure: true,
          providerErrorStatus: classified.status,
          providerErrorCode: classified.code,
          providerErrorType: classified.type,
        }
      }
    },
  }
}

export const createOpenAIBrasinhaReasoner = createOpenAIReasoner
