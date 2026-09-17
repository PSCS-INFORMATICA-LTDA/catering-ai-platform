import { paymentStatusCopy } from './mapPaymentNotification.ts'
import type { NotificationPayload } from './types.ts'

export function templateKeyForEvent(eventKey: string) {
  if (eventKey === 'payment.deposit_received') return 'payment_deposit_received_internal'
  if (eventKey === 'payment.full_received') return 'payment_full_received_internal'
  return 'new_quote_internal'
}

function money(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${currency || 'USD'} ${Number(value).toFixed(2)}`
}

export function whatsAppTemplateBody(input: {
  templateKey: string
  locale: 'pt' | 'en' | 'es'
  payload: NotificationPayload
}) {
  const eventWhen = [input.payload.eventDate, input.payload.eventTime].filter(Boolean).join(' ') || '—'
  if (input.templateKey === 'payment_deposit_received_internal') {
    return [
      input.payload.customerName || '—',
      eventWhen,
      input.payload.invoiceNumber || input.payload.invoiceId || '—',
      money(input.payload.amount, input.payload.currency),
      money(input.payload.paidTotal, input.payload.currency),
      money(input.payload.outstanding, input.payload.currency),
    ]
  }
  if (input.templateKey === 'payment_full_received_internal') {
    return [
      input.payload.customerName || '—',
      eventWhen,
      input.payload.invoiceNumber || input.payload.invoiceId || '—',
      money(input.payload.amount, input.payload.currency),
      money(input.payload.total, input.payload.currency),
      paymentStatusCopy(input.locale, input.payload),
    ]
  }
  return [
    input.payload.customerName || '—',
    eventWhen,
    input.payload.quoteNumber || input.payload.quoteId || '—',
    money(input.payload.total, input.payload.currency),
  ]
}

export function whatsAppButtonParameter(payload: NotificationPayload) {
  if (payload.invoiceId) return payload.invoiceId
  return payload.quoteId || payload.entityId
}
