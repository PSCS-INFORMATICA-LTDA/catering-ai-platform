export const V1_NOTIFICATION_EVENT_KEYS = [
  'quote.created',
  'payment.deposit_received',
  'payment.full_received',
] as const
export type V1NotificationEventKey = (typeof V1_NOTIFICATION_EVENT_KEYS)[number]

export const FUTURE_NOTIFICATION_EVENT_KEYS = [
  'payment.failed',
  'payment.refund_completed',
  'order.confirmed',
  'event.today',
  'event.tomorrow',
  'inventory.low_stock',
  'brasinha.action',
  'brasinha.customer_reply',
] as const

export const NOTIFICATION_EVENT_KEYS = [
  ...V1_NOTIFICATION_EVENT_KEYS,
  ...FUTURE_NOTIFICATION_EVENT_KEYS,
] as const
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

export type NotificationPayload = {
  eventKey: string
  entityType: string
  entityId: string
  quoteId?: string | null
  quoteNumber?: string | null
  invoiceId?: string | null
  invoiceNumber?: string | null
  paymentId?: string | null
  eventId?: string | null
  customerName?: string | null
  eventName?: string | null
  eventDate?: string | null
  eventTime?: string | null
  amount?: number | null
  paidTotal?: number | null
  outstanding?: number | null
  total?: number | null
  currency?: string | null
  invoiceStatus?: string | null
  invoiceFullyPaid?: boolean
  locale: 'pt' | 'en' | 'es'
  source: string
  deepLinkPath: string
}

/** @deprecated use NotificationPayload */
export type QuoteCreatedPayload = NotificationPayload

export type NotificationSendInput = {
  companyId: string
  channel: NotificationChannel
  toE164: string
  locale: 'pt' | 'en' | 'es'
  templateKey: string
  payload: NotificationPayload
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

export type WhatsAppResolvedConfig = {
  source: 'company' | 'env_fallback' | 'none'
  enabled: boolean
  accessToken: string
  phoneNumberId: string
  provider: string
}
