import { createDevSimulatorChannel } from './devSimulator.ts'
import { createWhatsAppChannel } from './whatsapp.ts'
import type { ConversationChannel } from './types.ts'

export function getBrasinhaChannel(
  id: 'dev_simulator' | 'whatsapp' | 'web' | 'voice',
): ConversationChannel {
  if (id === 'whatsapp') return createWhatsAppChannel()
  if (id === 'dev_simulator') return createDevSimulatorChannel()
  throw new Error(`${id}_channel_not_implemented`)
}
