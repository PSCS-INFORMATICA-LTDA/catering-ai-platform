import { hasPermission } from '@/Lib/auth/permissions'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { createInvoiceFromQuote } from '@/Lib/payments/createInvoiceFromQuote'
import { ensureOfflineMethods } from '@/Lib/payments/companyProviders'
import { invoiceAmountContext, loadInvoiceDueApiFields } from '@/Lib/payments/loadInvoiceAmountDue'
import { loadCompanyTimezone } from '@/Lib/payments/loadCompanyTimezone'
import {
  availabilityFromInvoiceSnapshot,
  paymentAvailabilityApiFields,
} from '@/Lib/payments/paymentPurposeAvailability'
import type { InvoiceSnapshot } from '@/Lib/payments/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.invoices.view')
  if (!auth.ok) return auth.response
  if (
    !auth.session.isPlatformAdmin &&
    !hasPermission(auth.session.permissions, 'quotes.manage')
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  await ensureOfflineMethods(companyId)

  const result = await createInvoiceFromQuote({
    companyId,
    quoteId: id,
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  const due = await loadInvoiceDueApiFields(invoiceAmountContext(result.invoice))
  const timezone = await loadCompanyTimezone(companyId)
  const availability = availabilityFromInvoiceSnapshot({
    snapshot: result.invoice.snapshot,
    invoiceKind: result.invoice.invoice_kind,
    invoiceStatus: result.invoice.status,
    depositDue: due.deposit_due,
    balanceDue: due.balance_due,
    fullDue: due.full_due,
    companyTimezone: timezone,
  })
  return Response.json({
    data: {
      id: result.invoice.id,
      invoice_number: result.invoice.invoice_number,
      status: result.invoice.status,
      total: result.invoice.total,
      deposit_amount: result.invoice.deposit_amount,
      balance_amount: result.invoice.balance_amount,
      paid_total: result.invoice.paid_total,
      already_existed: result.alreadyExisted,
      ...due,
      ...paymentAvailabilityApiFields(availability),
    },
  })
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.invoices.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { getSupabaseServerClient } = await import('@/Lib/supabaseServer')
  const { data } = await getSupabaseServerClient()
    .from('invoices')
    .select(
      'id, invoice_number, status, invoice_kind, locale, total, deposit_amount, balance_amount, paid_total, currency_code, created_at, snapshot',
    )
    .eq('company_id', companyId)
    .eq('quote_id', id)
    .eq('invoice_kind', 'original')
    .neq('status', 'canceled')
    .maybeSingle()

  if (!data) return Response.json({ data: null })

  const due = await loadInvoiceDueApiFields({
    companyId,
    invoiceId: String(data.id),
    total: Number(data.total),
    depositAmount: Number(data.deposit_amount),
    balanceAmount: Number(data.balance_amount),
    paidTotal: Number(data.paid_total),
  })
  const timezone = await loadCompanyTimezone(companyId)
  const availability = availabilityFromInvoiceSnapshot({
    snapshot: (data.snapshot || null) as InvoiceSnapshot | null,
    invoiceKind: String(data.invoice_kind || 'original'),
    invoiceStatus: String(data.status || ''),
    depositDue: due.deposit_due,
    balanceDue: due.balance_due,
    fullDue: due.full_due,
    companyTimezone: timezone,
  })

  const { snapshot: _snapshot, ...safeInvoice } = data
  void _snapshot

  return Response.json({
    data: {
      ...safeInvoice,
      ...due,
      ...paymentAvailabilityApiFields(availability),
    },
  })
}
