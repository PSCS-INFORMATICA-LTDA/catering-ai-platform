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
import { collectCanonicalAmounts, replyInventedPrice } from './priceGuard.ts'
import { buildBrasinhaSystemPrompt } from './prompt.ts'
import { classifyProviderError } from './providerError.ts'
import {
  createDeterministicReasoner,
  type BrasinhaReasoner,
  type BrasinhaReasonerInput,
  type BrasinhaReasonerResult,
} from './reasoner.ts'

const MAX_TOOL_ROUNDS = 3

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
    },
    timestamp: new Date().toISOString(),
    denied: Boolean(reason),
    reason,
  }
}

function hasUnreliableCommercialData(executions: Array<{ name: string; data: unknown }>) {
  return executions.some(
    (row) =>
      (row.name === 'get_package_details' ||
        row.name === 'get_catalog_item' ||
        row.name === 'get_quote_by_public_reference') &&
      row.data == null,
  )
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

  const profile = await input.catalog.getCompanyPublicProfile(
    input.companyId,
    input.language,
  )
  traces.push({
    ...profile.trace,
    reason: 'prompt_company_context',
  })

  const instructions = buildBrasinhaSystemPrompt({
    companyName: profile.data?.name ?? null,
    language: input.language,
  })
  const messages = [
    ...historyToAiMessages(input.history ?? []),
    { role: 'user' as const, content: input.text },
  ]

  let pendingCalls: BrasinhaAiToolCall[] = []
  let toolResults: Array<{ callId: string; name: string; output: string }> = []
  let text = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
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

  traces.push(auditTrace(input.companyId, model))

  if (!text || hasUnreliableCommercialData(executions) || replyInventedPrice(text, allowedAmounts)) {
    return {
      text: handoffReply(input.language),
      traces,
      toolsCalled,
      handoff: text && replyInventedPrice(text, allowedAmounts)
        ? 'price_not_canonical'
        : 'unknown_rule',
      provider: 'openai',
      model,
    }
  }

  return {
    text,
    traces,
    toolsCalled,
    handoff: null,
    provider: 'openai',
    model,
  }
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
