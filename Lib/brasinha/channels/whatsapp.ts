import { isWhatsAppChannelEnabled } from '../env.ts'
import type { OutboundMessage } from '../types.ts'
import { BrasinhaChannelDisabledError, type ConversationChannel } from './types.ts'

export let whatsappExternalCalls = 0

export function createWhatsAppChannel(
  source: Record<string, string | undefined> = process.env,
): ConversationChannel {
  return {
    id: 'whatsapp',
    enabled: isWhatsAppChannelEnabled(source),
    async receive() {
      throw new BrasinhaChannelDisabledError('whatsapp')
    },
    async send(_message: OutboundMessage) {
      throw new BrasinhaChannelDisabledError('whatsapp')
    },
  }
}

export const whatsappChannel = createWhatsAppChannel()
