import { isInvoiceFullyPaid } from '../payments/invoiceStatus.ts'

/** Never use invoice.balance_amount as current remaining balance. */
export function currentInvoiceOutstanding(input: {
  total: number | null | undefined
  paidTotal: number | null | undefined
}) {
  const total = Math.round((Number(input.total) || 0) * 100) / 100
  const paid = Math.round((Number(input.paidTotal) || 0) * 100) / 100
  return Math.max(0, Math.round((total - paid) * 100) / 100)
}

export function invoicePaidStatusLabel(
  locale: 'pt' | 'en' | 'es',
  input: { total: number; paidTotal: number; status?: string | null },
) {
  const fullyPaid =
    input.status === 'paid' ||
    isInvoiceFullyPaid({ total: input.total, paidTotal: input.paidTotal })
  if (fullyPaid) {
    if (locale === 'en') return 'Paid'
    if (locale === 'es') return 'Pagado'
    return 'Pago'
  }
  if (locale === 'en') return 'Partially paid'
  if (locale === 'es') return 'Parcialmente pagado'
  return 'Parcialmente pago'
}
