export const NOTIFICATION_EVENT_KEYS = ['quote.created'] as const
export type NotificationEventKey = (typeof NOTIFICATION_EVENT_KEYS)[number]

export const NOTIFICATION_CHANNELS = ['whatsapp', 'web_push', 'email', 'in_app'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_STATUSES = [
  'pending',
  'processing',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
] as const
export type NotificationDeliveryStatus = (typeof NOTIFICATION_STATUSES)[number]

export type QuoteCreatedPayload = {
  quoteId: string
  quoteNumber: string | null
  customerName: string | null
  eventDate: string | null
  eventTime: string | null
  total: number | null
  currency: string | null
  locale: 'pt' | 'en' | 'es'
  source: 'public_quote' | 'operator' | 'retry'
  deepLinkPath: string
}

export type NotificationSendInput = {
  companyId: string
  channel: NotificationChannel
  toE164: string
  locale: 'pt' | 'en' | 'es'
  templateKey: string
  payload: QuoteCreatedPayload
  deepLinkUrl: string
}

export type NotificationSendResult = {
  ok: boolean
  provider: string
  providerMessageId?: string | null
  error?: string | null
}

export type NotificationProvider = {
  channel: NotificationChannel
  send(input: NotificationSendInput): Promise<NotificationSendResult>
}
