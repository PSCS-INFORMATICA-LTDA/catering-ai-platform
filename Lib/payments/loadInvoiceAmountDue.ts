import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  invoiceDueApiFields,
  paidByPurposeFromLedger,
  resolveAmountDue,
  resolvePurposeAmounts,
  type AmountDueResult,
  type PaidByPurpose,
  type PurposeAmounts,
} from './amountDue'
import type { InvoiceRecord, PaymentPurpose } from './types'

export type InvoiceAmountContext = {
  companyId: string
  invoiceId: string
  total: number
  depositAmount: number
  balanceAmount: number
  paidTotal: number
}

export function invoiceAmountContext(invoice: InvoiceRecord): InvoiceAmountContext {
  return {
    companyId: invoice.company_id,
    invoiceId: invoice.id,
    total: invoice.total,
    depositAmount: invoice.deposit_amount,
    balanceAmount: invoice.balance_amount,
    paidTotal: invoice.paid_total,
  }
}

export async function loadInvoicePaidByPurpose(
  companyId: string,
  invoiceId: string,
): Promise<PaidByPurpose> {
  const supabase = getSupabaseServerClient()
  const [payments, refunds] = await Promise.all([
    supabase
      .from('invoice_payments')
      .select('id, purpose, amount, status')
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId),
    supabase
      .from('invoice_refunds')
      .select('payment_id, amount, status')
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId),
  ])

  return paidByPurposeFromLedger(payments.data ?? [], refunds.data ?? [])
}

export async function resolveServerAmountDue(
  invoice: InvoiceAmountContext,
  purpose: PaymentPurpose,
): Promise<AmountDueResult> {
  const paidByPurpose = await loadInvoicePaidByPurpose(invoice.companyId, invoice.invoiceId)
  return resolveAmountDue({
    total: invoice.total,
    depositAmount: invoice.depositAmount,
    balanceAmount: invoice.balanceAmount,
    paidTotal: invoice.paidTotal,
    purpose,
    paidByPurpose,
  })
}

export async function resolveServerPurposeAmounts(
  invoice: InvoiceAmountContext,
): Promise<PurposeAmounts> {
  const paidByPurpose = await loadInvoicePaidByPurpose(invoice.companyId, invoice.invoiceId)
  return resolvePurposeAmounts({
    total: invoice.total,
    depositAmount: invoice.depositAmount,
    balanceAmount: invoice.balanceAmount,
    paidTotal: invoice.paidTotal,
    paidByPurpose,
  })
}

export async function loadInvoiceDueApiFields(invoice: InvoiceAmountContext) {
  const paidByPurpose = await loadInvoicePaidByPurpose(invoice.companyId, invoice.invoiceId)
  return invoiceDueApiFields({
    total: invoice.total,
    depositAmount: invoice.depositAmount,
    balanceAmount: invoice.balanceAmount,
    paidTotal: invoice.paidTotal,
    paidByPurpose,
  })
}
