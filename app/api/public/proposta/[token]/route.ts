import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ found: false })
  }

  const db = getSupabaseServerClient()

  // Prefer RPC (Logistics pattern) when available
  const rpc = await db.rpc('get_public_quote_proposal', {
    p_token: token.trim(),
  })
  if (!rpc.error && rpc.data) {
    return Response.json(rpc.data)
  }

  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, quote_total, reservation_amount, balance_due, currency_code, language, adult_count, children_under_3_count, children_4_to_12_count, physical_guest_count, billable_guest_count, proposal_response, proposal_sent_at, customer_id, package_id, event_id, active',
    )
    .eq('proposal_token', token.trim())
    .eq('active', true)
    .maybeSingle()

  if (error) {
    if (/proposal_token|column/i.test(error.message)) {
      return Response.json({ found: false, error: 'migration_required' })
    }
    return Response.json({ found: false, error: error.message }, { status: 500 })
  }
  if (!quote) return Response.json({ found: false })

  const [companyRes, customerRes, eventRes, packageRes] = await Promise.all([
    db
      .from('companies')
      .select('name, trade_name')
      .eq('id', quote.company_id)
      .maybeSingle(),
    quote.customer_id
      ? db
          .from('customers')
          .select('full_name, ab_name, contact_name, company_name, phone, email')
          .eq('id', quote.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    quote.event_id
      ? db
          .from('events')
          .select('event_date, event_name')
          .eq('id', quote.event_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    quote.package_id
      ? db
          .from('packages')
          .select('label_pt, package_key')
          .eq('id', quote.package_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const customer = customerRes.data
  const customerName =
    customer?.full_name ||
    customer?.ab_name ||
    customer?.contact_name ||
    customer?.company_name ||
    null

  return Response.json({
    found: true,
    company_name:
      companyRes.data?.trade_name || companyRes.data?.name || 'BBQ At Home',
    proposal_response: quote.proposal_response ?? 'pending',
    proposal_sent_at: quote.proposal_sent_at,
    can_respond:
      (quote.proposal_response ?? 'pending') === 'pending' &&
      Boolean(quote.proposal_sent_at),
    quote: {
      id: quote.id,
      quote_number: quote.quote_number,
      quote_status: quote.quote_status,
      quote_total: quote.quote_total,
      reservation_amount: quote.reservation_amount,
      balance_due: quote.balance_due,
      currency_code: quote.currency_code ?? 'USD',
      package_label:
        packageRes.data?.label_pt || packageRes.data?.package_key || null,
      adult_count: quote.adult_count,
      children_under_3_count: quote.children_under_3_count,
      children_4_to_12_count: quote.children_4_to_12_count,
      physical_guest_count: quote.physical_guest_count,
      billable_guest_count: quote.billable_guest_count,
      customer_name: customerName,
      customer_phone: customer?.phone ?? null,
      customer_email: customer?.email ?? null,
      event_name: eventRes.data?.event_name ?? null,
      event_date: eventRes.data?.event_date ?? null,
      language: quote.language ?? 'pt',
    },
  })
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'accept' | 'reject'
  }
  if (body.action !== 'accept' && body.action !== 'reject') {
    return Response.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const rpc = await db.rpc('respond_to_quote_proposal', {
    p_token: token.trim(),
    p_action: body.action,
  })
  if (!rpc.error && rpc.data) {
    return Response.json({ data: rpc.data })
  }

  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, proposal_sent_at, proposal_response, quote_status, active',
    )
    .eq('proposal_token', token.trim())
    .eq('active', true)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!quote) {
    return Response.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }
  if (!quote.proposal_sent_at) {
    return Response.json(
      { error: 'Proposta ainda não foi enviada ao cliente' },
      { status: 409 },
    )
  }
  if (quote.proposal_response !== 'pending') {
    return Response.json({ error: 'Proposta já respondida' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const patch =
    body.action === 'accept'
      ? {
          proposal_response: 'accepted',
          proposal_accepted_at: now,
          quote_status: 'approved',
        }
      : {
          proposal_response: 'rejected',
          proposal_rejected_at: now,
          quote_status: 'cancelled',
        }

  const { data, error: updErr } = await db
    .from('quotes')
    .update(patch)
    .eq('id', quote.id)
    .select('proposal_response, quote_status')
    .single()

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 })
  }

  return Response.json({ data })
}
