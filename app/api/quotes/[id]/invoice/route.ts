import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { createInvoiceFromQuote } from '@/Lib/payments/createInvoiceFromQuote'
import { ensureOfflineMethods } from '@/Lib/payments/companyProviders'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

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
    },
  })
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { getSupabaseServerClient } = await import('@/Lib/supabaseServer')
  const { data } = await getSupabaseServerClient()
    .from('invoices')
    .select(
      'id, invoice_number, status, total, deposit_amount, balance_amount, paid_total, currency_code, created_at',
    )
    .eq('company_id', companyId)
    .eq('quote_id', id)
    .neq('status', 'canceled')
    .maybeSingle()

  return Response.json({ data: data ?? null })
}
