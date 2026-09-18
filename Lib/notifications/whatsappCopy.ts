import type { NotificationPayload } from './types.ts'

export function environmentBanner(locale: 'pt' | 'en' | 'es' = 'pt') {
  if (locale === 'en') return 'DEV TEST — NO REAL CHARGE'
  if (locale === 'es') return 'PRUEBA DEV — SIN COBRO REAL'
  return 'TESTE DEV — SEM COBRANÇA REAL'
}

export function eventHeadline(
  eventKey: string,
  locale: 'pt' | 'en' | 'es',
) {
  const banner = locale === 'en' ? 'DEV TEST' : locale === 'es' ? 'PRUEBA DEV' : 'TESTE DEV'
  if (eventKey === 'quote.accepted') {
    if (locale === 'en') return `${banner} — Customer accepted`
    if (locale === 'es') return `${banner} — Cliente aceptó`
    return `${banner} — Cliente aceitou`
  }
  if (eventKey === 'payment.deposit_received') {
    if (locale === 'en') return `${banner} — Deposit received`
    if (locale === 'es') return `${banner} — Señal recibida`
    return `${banner} — Sinal recebido`
  }
  if (eventKey === 'payment.full_received') {
    if (locale === 'en') return `${banner} — Invoice settled`
    if (locale === 'es') return `${banner} — Factura saldada`
    return `${banner} — Fatura quitada`
  }
  if (locale === 'en') return `${banner} — New quote`
  if (locale === 'es') return `${banner} — Nuevo presupuesto`
  return `${banner} — Nova cotação`
}

export function whatsAppPreviewLines(input: {
  locale: 'pt' | 'en' | 'es'
  payload: NotificationPayload
}) {
  const locale = input.locale
  const payload = input.payload
  const headline = eventHeadline(payload.eventKey, locale)
  const money = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(Number(value))) return '—'
    return `${payload.currency || 'USD'} ${Number(value).toFixed(2)}`
  }
  const eventWhen = [payload.eventDate, payload.eventTime].filter(Boolean).join(' ') || '—'
  const lines = [
    headline,
    environmentBanner(locale),
    locale === 'en' ? `Customer: ${payload.customerName || '—'}` : locale === 'es' ? `Cliente: ${payload.customerName || '—'}` : `Cliente: ${payload.customerName || '—'}`,
    locale === 'en' ? `Event: ${payload.eventName || eventWhen}` : locale === 'es' ? `Evento: ${payload.eventName || eventWhen}` : `Evento: ${payload.eventName || eventWhen}`,
  ]
  if (payload.eventKey.startsWith('payment.')) {
    lines.push(
      locale === 'en' ? `Invoice: ${payload.invoiceNumber || '—'}` : locale === 'es' ? `Factura: ${payload.invoiceNumber || '—'}` : `Fatura: ${payload.invoiceNumber || '—'}`,
      locale === 'en' ? `Received now: ${money(payload.amount)}` : locale === 'es' ? `Recibido ahora: ${money(payload.amount)}` : `Recebido agora: ${money(payload.amount)}`,
    )
    if (payload.eventKey === 'payment.deposit_received') {
      lines.push(
        locale === 'en' ? `Total paid: ${money(payload.paidTotal)}` : locale === 'es' ? `Total pagado: ${money(payload.paidTotal)}` : `Total pago: ${money(payload.paidTotal)}`,
        locale === 'en' ? `Current balance: ${money(payload.outstanding)}` : locale === 'es' ? `Saldo actual: ${money(payload.outstanding)}` : `Saldo atual: ${money(payload.outstanding)}`,
      )
    } else {
      lines.push(
        locale === 'en'
          ? `Current balance: ${payload.invoiceFullyPaid ? 'zero' : money(payload.outstanding)}`
          : locale === 'es'
            ? `Saldo actual: ${payload.invoiceFullyPaid ? 'cero' : money(payload.outstanding)}`
            : `Saldo atual: ${payload.invoiceFullyPaid ? 'zero' : money(payload.outstanding)}`,
      )
      if (payload.complementaryInvoicePending) {
        lines.push(
          locale === 'en'
            ? 'This invoice is settled. Another complementary invoice is still open.'
            : locale === 'es'
              ? 'Esta factura está saldada. Otra factura complementaria sigue abierta.'
              : 'Esta fatura está quitada. Outra fatura complementar ainda está aberta.',
        )
      }
    }
  } else {
    lines.push(
      locale === 'en' ? `Quote: ${payload.quoteNumber || '—'}` : locale === 'es' ? `Presupuesto: ${payload.quoteNumber || '—'}` : `Cotação: ${payload.quoteNumber || '—'}`,
    )
    if (payload.total != null) {
      lines.push(
        locale === 'en' ? `Total: ${money(payload.total)}` : locale === 'es' ? `Total: ${money(payload.total)}` : `Total: ${money(payload.total)}`,
      )
    }
  }
  lines.push(
    locale === 'en' ? 'Open transaction' : locale === 'es' ? 'Ver transacción' : 'Ver transação',
  )
  return lines
}
