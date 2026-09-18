import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { enqueueNotificationEventSafe } from './enqueueEvent'
import { buildPaymentNotificationPayload } from './mapPaymentNotification'
import { environmentBanner } from './whatsappCopy'

export type EnqueuePaymentReceivedInput = {
  companyId: string
  paymentId: string
  purpose: string
  amount: number
  currency?: string | null
  invoiceId: string
  invoiceNumber?: string | null
  invoiceTotal: number
  invoicePaidTotal: number
  invoiceStatus?: string | null
  quoteId?: string | null
  source: string
}

export async function enqueuePaymentReceivedNotification(input: EnqueuePaymentReceivedInput) {
  const db = getSupabaseServerClient()
  const { data: invoice } = await db
    .from('invoices')
    .select('invoice_number, quote_id, locale, snapshot, parent_invoice_id')
    .eq('id', input.invoiceId)
    .eq('company_id', input.companyId)
    .maybeSingle()

  let complementaryInvoicePending = false
  const quoteId = input.quoteId || invoice?.quote_id || null
  if (quoteId) {
    const { data: siblings } = await db
      .from('invoices')
      .select('id, status, total, paid_total')
      .eq('company_id', input.companyId)
      .eq('quote_id', quoteId)
      .neq('id', input.invoiceId)
    complementaryInvoicePending = (siblings ?? []).some((row) => {
      const status = String(row.status || '')
      if (status === 'canceled' || status === 'paid') return false
      return Number(row.paid_total || 0) + 0.009 < Number(row.total || 0)
    })
  }

  const mapped = buildPaymentNotificationPayload({
    ...input,
    currency: input.currency ?? null,
    locale: 'pt',
    source: input.source,
    complementaryInvoicePending,
  })
  if (!mapped) return { eventId: null, deliveryCount: 0, eventKey: null as string | null }

  const snapshot = (invoice?.snapshot || {}) as {
    customer?: { name?: string }
    event?: { name?: string; date?: string; startTime?: string; endTime?: string }
    quote?: { id?: string; number?: string }
  }
  const locale =
    invoice?.locale === 'en' || invoice?.locale === 'es' ? invoice.locale : mapped.payload.locale
  const payload = {
    ...mapped.payload,
    invoiceNumber: input.invoiceNumber || invoice?.invoice_number || mapped.payload.invoiceNumber,
    quoteId: quoteId || snapshot.quote?.id || mapped.payload.quoteId,
    quoteNumber: snapshot.quote?.number || mapped.payload.quoteNumber,
    customerName: snapshot.customer?.name || mapped.payload.customerName,
    eventName: snapshot.event?.name || mapped.payload.eventName,
    eventDate: snapshot.event?.date || mapped.payload.eventDate,
    eventTime:
      [snapshot.event?.startTime, snapshot.event?.endTime].filter(Boolean).join(' – ') ||
      mapped.payload.eventTime,
    locale,
    environmentBanner: environmentBanner(locale),
  }

  const result = await enqueueNotificationEventSafe({
    companyId: input.companyId,
    eventKey: mapped.eventKey,
    entityType: 'invoice_payment',
    entityId: input.paymentId,
    payload,
    source: input.source,
  })
  return { ...result, eventKey: mapped.eventKey }
}

export async function enqueuePaymentReceivedNotificationSafe(input: EnqueuePaymentReceivedInput) {
  try {
    return await enqueuePaymentReceivedNotification(input)
  } catch (error) {
    console.warn('[notifications] payment enqueue failed', {
      paymentId: input.paymentId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return { eventId: null, deliveryCount: 0, eventKey: null as string | null }
  }
}
