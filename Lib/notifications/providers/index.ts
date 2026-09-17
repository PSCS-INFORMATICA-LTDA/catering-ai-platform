import type { NotificationChannel, NotificationProvider } from '../types'
import { whatsAppMetaProvider } from './whatsappMeta'

const providers: Partial<Record<NotificationChannel, NotificationProvider>> = {
  whatsapp: whatsAppMetaProvider,
}

export function getNotificationProvider(channel: NotificationChannel) {
  return providers[channel] ?? null
}
