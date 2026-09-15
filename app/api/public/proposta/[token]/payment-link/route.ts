import { ignoreClientAmount } from '@/Lib/payments/amountDue'
import { createPayablePaymentLink } from '@/Lib/payments/createPayablePaymentLink'
import { createInvoiceFromQuote } from '@/Lib/payments/createInvoiceFromQuote'
import { isPaymentPurpose } from '@/Lib/payments/paymentLinks'
import { publicPaymentGate } from '@/Lib/payments/publicPaymentSnapshot'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    purpose?: unknown
    amount?: unknown
    invoice_id?: unknown
    company_id?: unknown
    currency?: unknown
    customer_id?: unknown
    paid_total?: unknown
  }

  ignoreClientAmount(body.amount)
  void body.invoice_id
  void body.company_id
  void body.currency
  void body.customer_id
  void body.paid_total

  if (!isPaymentPurpose(body.purpose)) {
    return Response.json({ error: 'invalid_purpose' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_status, proposal_response, proposal_sent_at, proposal_token, active',
    )
    .eq('proposal_token', token.trim())
    .eq('active', true)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const gate = publicPaymentGate({
    found: Boolean(quote),
    proposalSentAt: quote?.proposal_sent_at ?? null,
    proposalResponse: quote?.proposal_response ?? null,
    quoteStatus: quote?.quote_status ?? null,
  })
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const invoice = await createInvoiceFromQuote({
    companyId: String(quote!.company_id),
    quoteId: String(quote!.id),
  })
  if (!invoice.ok) {
    return Response.json({ error: invoice.error }, { status: invoice.status })
  }

  const created = await createPayablePaymentLink({
    companyId: String(quote!.company_id),
    invoiceId: invoice.invoice.id,
    purpose: body.purpose,
    origin: new URL(request.url).origin,
  })
  if (!created.ok) {
    return Response.json(
      {
        error: created.error,
        deposit_due: created.deposit_due,
        balance_due: created.balance_due,
        full_due: created.full_due,
        available_at: created.available_at ?? null,
      },
      { status: created.status },
    )
  }

  return Response.json({
    data: {
      purpose: created.purpose,
      url: created.url,
      token: created.token,
      amount: created.amount,
      currency: created.currency,
      deposit_due: created.deposit_due,
      balance_due: created.balance_due,
      full_due: created.full_due,
    },
  })
}
