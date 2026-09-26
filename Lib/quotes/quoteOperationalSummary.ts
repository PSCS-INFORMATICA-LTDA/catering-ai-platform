import { isRealFinancialPayment } from '../payments/paypal/checkoutPolicy.ts'

export type QuoteFinanceStatus =
  | 'awaiting_deposit'
  | 'deposit_paid'
  | 'paid_in_full'
  | 'operational_error'

export type QuoteServiceOrderState = 'created' | 'pending'

export type QuoteOperationalSummary = {
  total: number | null
  deposit_required: number | null
  paid_total: number
  balance: number | null
  finance_status: QuoteFinanceStatus
  service_order: QuoteServiceOrderState
  service_order_id: string | null
}

export type ContractInvoiceSnapshot = {
  id: string
  quote_id: string
  status: string | null
  total: number | null
  deposit_amount: number | null
  paid_total: number | null
  created_at: string | null
}

export type ContractPaymentSnapshot = {
  invoice_id: string
  provider: string | null
  status: string | null
  amount: number | null
  metadata?: unknown
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

export function realPaidFromInvoice(
  invoice: ContractInvoiceSnapshot | null,
  payments: readonly ContractPaymentSnapshot[],
): number {
  if (!invoice) return 0
  const sandbox = payments
    .filter(
      (payment) =>
        payment.invoice_id === invoice.id &&
        payment.provider === 'paypal' &&
        payment.status === 'completed' &&
        !isRealFinancialPayment({
          provider: String(payment.provider ?? ''),
          status: String(payment.status ?? ''),
          metadata: payment.metadata,
        }),
    )
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  return money(Math.max(0, Number(invoice.paid_total ?? 0) - sandbox))
}

export function buildQuoteOperationalSummary(input: {
  quoteTotal: number | null
  reservationAmount: number | null
  balanceDue: number | null
  convertedServiceOrderId: string | null
  invoice: ContractInvoiceSnapshot | null
  payments: readonly ContractPaymentSnapshot[]
  serviceOrderId: string | null
  agendaReserved: boolean
}): QuoteOperationalSummary {
  const serviceOrderId = input.serviceOrderId || input.convertedServiceOrderId || null
  const service_order: QuoteServiceOrderState = serviceOrderId ? 'created' : 'pending'
  const total = input.invoice ? Number(input.invoice.total ?? input.quoteTotal) : input.quoteTotal
  const deposit =
    input.invoice?.deposit_amount != null
      ? Number(input.invoice.deposit_amount)
      : input.reservationAmount
  const paid = realPaidFromInvoice(input.invoice, input.payments)
  const balance =
    total != null ? money(Math.max(0, Number(total) - paid)) : input.balanceDue
  const depositRequired = Number(deposit ?? 0)
  const depositCovered = depositRequired > 0 && paid + 0.009 >= depositRequired
  const paidInFull = total != null && Number(total) > 0 && paid + 0.009 >= Number(total)
  const operationsFailed = depositCovered && (!serviceOrderId || !input.agendaReserved)

  let finance_status: QuoteFinanceStatus = 'awaiting_deposit'
  if (operationsFailed) finance_status = 'operational_error'
  else if (paidInFull) finance_status = 'paid_in_full'
  else if (depositCovered || paid > 0) finance_status = 'deposit_paid'

  return {
    total: total == null ? null : money(Number(total)),
    deposit_required: deposit == null ? null : money(Number(deposit)),
    paid_total: paid,
    balance: balance == null ? null : money(Number(balance)),
    finance_status,
    service_order,
    service_order_id: serviceOrderId,
  }
}

/** Manual conversion stays a fallback. Never offer it when the OS already exists. */
export function shouldOfferManualServiceOrderConversion(input: {
  proposalAccepted: boolean
  serviceOrderId: string | null
}): boolean {
  return input.proposalAccepted && !input.serviceOrderId
}
