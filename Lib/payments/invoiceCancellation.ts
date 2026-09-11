import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export async function hasActiveInvoiceCancellation(
  companyId: string,
  invoiceId: string,
): Promise<boolean> {
  if (!companyId || !invoiceId) return true
  const { data, error } = await getSupabaseServerClient()
    .from('invoice_cancellations')
    .select('id')
    .eq('company_id', companyId)
    .eq('invoice_id', invoiceId)
    .in('status', ['requested', 'pending_refund'])
    .limit(1)

  if (error) {
    // Money movement must fail closed if cancellation state cannot be verified.
    return true
  }
  return Boolean(data?.length)
}

export async function assertInvoiceAcceptsPayment(
  companyId: string,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: 'invoice_cancellation_pending' }> {
  const canceling = await hasActiveInvoiceCancellation(companyId, invoiceId)
  return canceling
    ? { ok: false, error: 'invoice_cancellation_pending' }
    : { ok: true }
}
