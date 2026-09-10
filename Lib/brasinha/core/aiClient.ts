import OpenAI from 'openai'
import type { BrasinhaAiToolDefinition } from './aiTools.ts'

export type BrasinhaAiMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type BrasinhaAiToolCall = {
  callId: string
  name: string
  arguments: Record<string, unknown>
}

export type BrasinhaAiCompleteInput = {
  model: string
  instructions: string
  messages: BrasinhaAiMessage[]
  tools: BrasinhaAiToolDefinition[]
  pendingCalls?: BrasinhaAiToolCall[]
  toolResults?: Array<{ callId: string; name: string; output: string }>
}

export type BrasinhaAiCompleteResult = {
  responseId: string
  text: string | null
  toolCalls: BrasinhaAiToolCall[]
}

export type BrasinhaAiClient = {
  complete(input: BrasinhaAiCompleteInput): Promise<BrasinhaAiCompleteResult>
}

function parseArgs(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || '{}') as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function createOpenAISdkClient(
  source: Record<string, string | undefined> = process.env,
): BrasinhaAiClient {
  const apiKey = source.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('openai_api_key_missing')
  }
  const client = new OpenAI({
    apiKey,
    timeout: 20_000,
    maxRetries: 1,
  })

  return {
    async complete(input) {
      const tools = input.tools.map((tool) => ({
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      }))
      const items: Array<Record<string, unknown>> = input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      }))
      if (input.pendingCalls?.length && input.toolResults?.length) {
        for (const call of input.pendingCalls) {
          items.push({
            type: 'function_call',
            call_id: call.callId,
            name: call.name,
            arguments: JSON.stringify(call.arguments),
          })
        }
        for (const result of input.toolResults) {
          items.push({
            type: 'function_call_output',
            call_id: result.callId,
            output: result.output,
          })
        }
      }

      const response = await client.responses.create({
        model: input.model,
        instructions: input.instructions,
        input: items as never,
        tools,
        max_output_tokens: 500,
        store: false,
        parallel_tool_calls: true,
      })

      const toolCalls: BrasinhaAiToolCall[] = []
      for (const item of response.output ?? []) {
        if (item.type !== 'function_call') continue
        toolCalls.push({
          callId: item.call_id,
          name: item.name,
          arguments: parseArgs(item.arguments),
        })
      }

      const text = (response.output_text ?? '').trim()
      return {
        responseId: response.id,
        text: toolCalls.length ? null : text || null,
        toolCalls,
      }
    },
  }
}
