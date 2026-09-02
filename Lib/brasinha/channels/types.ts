import type { InboundMessage, OutboundMessage } from '../types'

export class BrasinhaChannelDisabledError extends Error {
  readonly channel: string
  constructor(channel: string) {
    super(`${channel}_channel_disabled`)
    this.channel = channel
  }
}

export type ConversationChannel = {
  id: 'dev_simulator' | 'whatsapp' | 'web' | 'voice'
  enabled: boolean
  receive(raw: unknown): Promise<InboundMessage>
  send(message: OutboundMessage): Promise<{ delivered: boolean; externalCalls: number }>
}
