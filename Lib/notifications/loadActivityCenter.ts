import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { currentInvoiceOutstanding } from './outstanding'
import { maskPhone } from './maskPhone'
import { V1_NOTIFICATION_EVENT_KEYS } from './types'

export type ActivityFilter = {
  from?: string | null
  to?: string | null
  query?: string | null
  type?: string | null
  status?: string | null
}

export type ActivityTransaction = {
  id: string
  createdAt: string
  customerName: string | null
  eventName: string | null
  quoteId: string | null
  quoteNumber: string | null
  invoiceId: string
  invoiceNumber: string | null
  purpose: string
  amount: number
  paidTotal: number
  outstanding: number
  currency: string
  financialStatus: string
  whatsappStatuses: string[]
  openPath: string
}

export type ActivityWhatsAppRow = {
  id: string
  createdAt: string
  eventKey: string
  customerName: string | null
  eventName: string | null
  entityLabel: string
  recipientName: string | null
  phoneMasked: string | null
  status: string
  attemptCount: number
  lastError: string | null
  openPath: string | null
}

export type ActivityTimelineItem = {
  at: string
  kind: string
  labelKey: string
  status?: string | null
  amount?: number | null
  currency?: string | null
  openPath?: string | null
}

export type ActivityCenterData = {
  summary: {
    quotesCreated: number
    quotesAccepted: number
    deposits: number
    settled: number
    needsAttention: number
  }
  transactions: ActivityTransaction[]
  activities: ActivityWhatsAppRow[]
  currencies: string[]
}

function inRange(iso: string | null | undefined, from?: string | null, to?: string | null) {
  if (!iso) return true
  const time = new Date(iso).getTime()
  if (from && time < new Date(from).getTime()) return false
  if (to && time > new Date(`${to}T23:59:59.999Z`).getTime()) return false
  return true
}

export async function loadActivityCenter(
  companyId: string,
  filters: ActivityFilter = {},
): Promise<ActivityCenterData> {
  const db = getSupabaseServerClient()
  const [paymentsResult, eventsResult, deliveriesResult] = await Promise.all([
    db
      .from('invoice_payments')
      .select(
        'id, invoice_id, purpose, amount, currency_code, status, created_at, captured_at, invoices(id, invoice_number, quote_id, total, paid_total, status, currency_code, snapshot)',
      )
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('notification_events')
      .select('id, event_key, entity_type, entity_id, payload, created_at')
      .eq('company_id', companyId)
      .in('event_key', [...V1_NOTIFICATION_EVENT_KEYS])
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('notification_deliveries')
      .select(
        'id, status, attempt_count, last_error, created_at, event_id, notification_events(event_key, entity_id, payload), notification_recipients(display_name, phone_e164)',
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const events = eventsResult.data ?? []
  const deliveries = deliveriesResult.data ?? []
  const payments = paymentsResult.data ?? []
  const deliveriesByPayment = new Map<string, string[]>()
  for (const row of deliveries) {
    const event = Array.isArray(row.notification_events)
      ? row.notification_events[0]
      : row.notification_events
    const paymentId = String(
      ((event?.payload || {}) as { paymentId?: string }).paymentId || event?.entity_id || '',
    )
    if (!paymentId) continue
    const list = deliveriesByPayment.get(paymentId) ?? []
    list.push(String(row.status))
    deliveriesByPayment.set(paymentId, list)
  }

  const query = String(filters.query || '').trim().toLowerCase()
  const transactions: ActivityTransaction[] = []
  const currencies = new Set<string>()

  for (const payment of payments) {
    const invoice = Array.isArray(payment.invoices) ? payment.invoices[0] : payment.invoices
    if (!invoice) continue
    if (!inRange(payment.created_at, filters.from, filters.to)) continue
    const snapshot = (invoice.snapshot || {}) as {
      customer?: { name?: string }
      event?: { name?: string }
      quote?: { number?: string; id?: string }
    }
    const customerName = snapshot.customer?.name || null
    const eventName = snapshot.event?.name || null
    const quoteNumber = snapshot.quote?.number || null
    if (filters.type && filters.type !== 'payment' && filters.type !== payment.purpose) continue
    if (query) {
      const hay = `${customerName || ''} ${eventName || ''} ${invoice.invoice_number || ''} ${quoteNumber || ''}`.toLowerCase()
      if (!hay.includes(query)) continue
    }
    const outstanding = currentInvoiceOutstanding({
      total: Number(invoice.total || 0),
      paidTotal: Number(invoice.paid_total || 0),
    })
    const currency = String(payment.currency_code || invoice.currency_code || 'USD')
    currencies.add(currency)
    const financialStatus = String(invoice.status || '')
    if (filters.status && filters.status !== financialStatus) continue
    transactions.push({
      id: String(payment.id),
      createdAt: String(payment.captured_at || payment.created_at),
      customerName,
      eventName,
      quoteId: invoice.quote_id || snapshot.quote?.id || null,
      quoteNumber,
      invoiceId: String(invoice.id),
      invoiceNumber: invoice.invoice_number || null,
      purpose: String(payment.purpose),
      amount: Number(payment.amount || 0),
      paidTotal: Number(invoice.paid_total || 0),
      outstanding,
      currency,
      financialStatus,
      whatsappStatuses: deliveriesByPayment.get(String(payment.id)) ?? [],
      openPath: `/invoices/${invoice.id}`,
    })
  }

  const activities: ActivityWhatsAppRow[] = deliveries
    .map((row) => {
      const event = Array.isArray(row.notification_events)
        ? row.notification_events[0]
        : row.notification_events
      const recipient = Array.isArray(row.notification_recipients)
        ? row.notification_recipients[0]
        : row.notification_recipients
      const payload = (event?.payload || {}) as Record<string, unknown>
      return {
        id: String(row.id),
        createdAt: String(row.created_at),
        eventKey: String(event?.event_key || ''),
        customerName: (payload.customerName as string | undefined) || null,
        eventName: (payload.eventName as string | undefined) || null,
        entityLabel:
          (payload.invoiceNumber as string | undefined) ||
          (payload.quoteNumber as string | undefined) ||
          String(event?.entity_id || ''),
        recipientName: recipient?.display_name || null,
        phoneMasked: maskPhone(recipient?.phone_e164),
        status: String(row.status),
        attemptCount: Number(row.attempt_count || 0),
        lastError: row.last_error || null,
        openPath: (payload.deepLinkPath as string | undefined) || null,
      }
    })
    .filter((row) => {
      if (!inRange(row.createdAt, filters.from, filters.to)) return false
      if (filters.type && filters.type !== row.eventKey && filters.type !== 'whatsapp') return false
      if (filters.status && filters.status !== row.status) return false
      if (!query) return true
      const hay = `${row.customerName || ''} ${row.eventName || ''} ${row.entityLabel} ${row.recipientName || ''}`.toLowerCase()
      return hay.includes(query)
    })

  const needsAttention = activities.filter((row) =>
    ['failed', 'uncertain', 'pending'].includes(row.status),
  ).length

  return {
    summary: {
      quotesCreated: events.filter((row) => row.event_key === 'quote.created').length,
      quotesAccepted: events.filter((row) => row.event_key === 'quote.accepted').length,
      deposits: events.filter((row) => row.event_key === 'payment.deposit_received').length,
      settled: events.filter((row) => row.event_key === 'payment.full_received').length,
      needsAttention,
    },
    transactions,
    activities,
    currencies: [...currencies],
  }
}

export async function loadActivityTimeline(input: {
  companyId: string
  quoteId?: string | null
  invoiceId?: string | null
}): Promise<ActivityTimelineItem[]> {
  const db = getSupabaseServerClient()
  const items: ActivityTimelineItem[] = []
  if (input.quoteId) {
    const { data: quote } = await db
      .from('quotes')
      .select(
        'id, quote_number, created_at, proposal_accepted_at, accepted_version_id, reservation_confirmed_at, quote_status',
      )
      .eq('id', input.quoteId)
      .eq('company_id', input.companyId)
      .maybeSingle()
    if (quote?.created_at) {
      items.push({
        at: quote.created_at,
        kind: 'quote.created',
        labelKey: 'timelineQuoteCreated',
        openPath: `/quotes/${quote.id}`,
      })
    }
    if (quote?.proposal_accepted_at) {
      items.push({
        at: quote.proposal_accepted_at,
        kind: 'quote.accepted',
        labelKey: 'timelineQuoteAccepted',
        status: quote.accepted_version_id,
        openPath: `/quotes/${quote.id}`,
      })
    }
    if (quote?.reservation_confirmed_at) {
      items.push({
        at: quote.reservation_confirmed_at,
        kind: 'order.confirmed',
        labelKey: 'timelineReservation',
        openPath: `/quotes/${quote.id}`,
      })
    }
  }

  let invoiceQuery = db
    .from('invoices')
    .select('id, invoice_number, quote_id, status, total, paid_total, created_at')
    .eq('company_id', input.companyId)
  if (input.invoiceId) invoiceQuery = invoiceQuery.eq('id', input.invoiceId)
  else if (input.quoteId) invoiceQuery = invoiceQuery.eq('quote_id', input.quoteId)
  const { data: invoices } = await invoiceQuery

  const invoiceIds = (invoices ?? []).map((row) => String(row.id))
  if (invoiceIds.length > 0) {
    const { data: payments } = await db
      .from('invoice_payments')
      .select('id, invoice_id, purpose, amount, currency_code, status, created_at, captured_at')
      .eq('company_id', input.companyId)
      .in('invoice_id', invoiceIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
    for (const payment of payments ?? []) {
      items.push({
        at: String(payment.captured_at || payment.created_at),
        kind: payment.purpose === 'deposit' ? 'payment.deposit_received' : 'payment.received',
        labelKey: payment.purpose === 'deposit' ? 'timelineDeposit' : 'timelinePayment',
        amount: Number(payment.amount || 0),
        currency: payment.currency_code,
        openPath: `/invoices/${payment.invoice_id}`,
      })
    }
    for (const invoice of invoices ?? []) {
      if (invoice.status === 'paid') {
        items.push({
          at: invoice.created_at,
          kind: 'payment.full_received',
          labelKey: 'timelineSettled',
          openPath: `/invoices/${invoice.id}`,
        })
      }
    }
  }

  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}
