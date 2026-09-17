import { isInvoiceFullyPaid } from '../payments/invoiceStatus.ts'
import { invoiceDeepLinkPath } from './env.ts'
import { currentInvoiceOutstanding, invoicePaidStatusLabel } from './outstanding.ts'
import type { NotificationPayload, V1NotificationEventKey } from './types.ts'

export function paymentNotificationEventKey(input: {
  purpose: string | null | undefined
  status: string | null | undefined
  invoiceTotal: number
  invoicePaidTotal: number
  invoiceStatus?: string | null
}): V1NotificationEventKey | null {
  if (input.status !== 'completed') return null
  if (input.purpose === 'deposit') return 'payment.deposit_received'
  if (input.purpose === 'full') return 'payment.full_received'
  if (
    input.purpose === 'balance' &&
    (input.invoiceStatus === 'paid' ||
      isInvoiceFullyPaid({ total: input.invoiceTotal, paidTotal: input.invoicePaidTotal }))
  ) {
    return 'payment.full_received'
  }
  return null
}

export function buildPaymentNotificationPayload(input: {
  companyId: string
  paymentId: string
  purpose: string
  amount: number
  currency: string | null
  invoiceId: string
  invoiceNumber?: string | null
  invoiceTotal: number
  invoicePaidTotal: number
  invoiceStatus?: string | null
  quoteId?: string | null
  quoteNumber?: string | null
  eventId?: string | null
  customerName?: string | null
  eventName?: string | null
  eventDate?: string | null
  eventTime?: string | null
  locale?: 'pt' | 'en' | 'es' | null
  source: string
}): { eventKey: V1NotificationEventKey; payload: NotificationPayload } | null {
  const eventKey = paymentNotificationEventKey({
    purpose: input.purpose,
    status: 'completed',
    invoiceTotal: input.invoiceTotal,
    invoicePaidTotal: input.invoicePaidTotal,
    invoiceStatus: input.invoiceStatus,
  })
  if (!eventKey) return null
  const locale = input.locale === 'en' || input.locale === 'es' ? input.locale : 'pt'
  const outstanding = currentInvoiceOutstanding({
    total: input.invoiceTotal,
    paidTotal: input.invoicePaidTotal,
  })
  const fullyPaid =
    input.invoiceStatus === 'paid' ||
    isInvoiceFullyPaid({ total: input.invoiceTotal, paidTotal: input.invoicePaidTotal })
  return {
    eventKey,
    payload: {
      eventKey,
      entityType: 'invoice_payment',
      entityId: input.paymentId,
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber ?? null,
      quoteId: input.quoteId ?? null,
      quoteNumber: input.quoteNumber ?? null,
      eventId: input.eventId ?? null,
      customerName: input.customerName ?? null,
      eventName: input.eventName ?? null,
      eventDate: input.eventDate ?? null,
      eventTime: input.eventTime ?? null,
      amount: input.amount,
      paidTotal: input.invoicePaidTotal,
      outstanding,
      total: input.invoiceTotal,
      currency: input.currency ?? 'USD',
      invoiceStatus: fullyPaid ? 'paid' : input.invoiceStatus ?? null,
      invoiceFullyPaid: fullyPaid,
      locale,
      source: input.source,
      deepLinkPath: invoiceDeepLinkPath(input.invoiceId),
    },
  }
}

export function paymentStatusCopy(
  locale: 'pt' | 'en' | 'es',
  payload: Pick<NotificationPayload, 'total' | 'paidTotal' | 'invoiceStatus' | 'invoiceFullyPaid'>,
) {
  return invoicePaidStatusLabel(locale, {
    total: Number(payload.total || 0),
    paidTotal: Number(payload.paidTotal || 0),
    status: payload.invoiceFullyPaid ? 'paid' : payload.invoiceStatus,
  })
}
