import type { BrasinhaStoredMessage } from '../types.ts'

export const BRASINHA_HISTORY_WINDOW = 16
const MAX_MESSAGE_CHARS = 1200

export function selectConversationHistory(
  messages: BrasinhaStoredMessage[],
  options: { excludeLastInbound?: boolean; limit?: number } = {},
): BrasinhaStoredMessage[] {
  const limit = options.limit ?? BRASINHA_HISTORY_WINDOW
  const source =
    options.excludeLastInbound && messages.length
      ? messages.slice(0, -1)
      : messages
  return source
    .filter((row) => row.role === 'customer' || row.role === 'assistant')
    .slice(-limit)
    .map((row) => ({
      ...row,
      content:
        row.content.length > MAX_MESSAGE_CHARS
          ? `${row.content.slice(0, MAX_MESSAGE_CHARS)}…`
          : row.content,
    }))
}

export function historyToAiMessages(
  history: BrasinhaStoredMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history.map((row) => ({
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
  }))
}
