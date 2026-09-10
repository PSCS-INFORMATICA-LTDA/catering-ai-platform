import type { ConversationChannel } from './types'
import type { InboundMessage, OutboundMessage } from '../types'

export function createDevSimulatorChannel(): ConversationChannel {
  return {
    id: 'dev_simulator',
    enabled: true,
    async receive(raw) {
      const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      return {
        channel: 'dev_simulator',
        companyId: String(body.companyId ?? ''),
        conversationId:
          typeof body.conversationId === 'string' ? body.conversationId : null,
        externalContactRef:
          typeof body.externalContactRef === 'string'
            ? body.externalContactRef
            : 'dev-simulator',
        languageHint: null,
        text: String(body.text ?? ''),
        receivedAt: new Date().toISOString(),
      } satisfies InboundMessage
    },
    async send(_message: OutboundMessage) {
      return { delivered: true, externalCalls: 0 }
    },
  }
}
