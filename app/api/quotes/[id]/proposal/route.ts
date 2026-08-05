import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { newProposalToken } from '@/Lib/quoteProposal'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

async function loadQuote(quoteId: string, companyId: string) {
  return getSupabaseServerClient()
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, proposal_token, proposal_sent_at, proposal_response, proposal_accepted_at, proposal_rejected_at, proposal_follow_up_count, proposal_last_follow_up_at, quote_total, reservation_amount, currency_code, customer_id, package_id, active',
    )
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await loadQuote(id, companyId)
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Cotação não encontrada' }, { status: 404 })
  }

  return Response.json({
    data: {
      proposal_token: data.proposal_token,
      proposal_sent_at: data.proposal_sent_at,
      proposal_response: data.proposal_response ?? 'pending',
      proposal_accepted_at: data.proposal_accepted_at,
      proposal_rejected_at: data.proposal_rejected_at,
      proposal_follow_up_count: data.proposal_follow_up_count ?? 0,
      proposal_last_follow_up_at: data.proposal_last_follow_up_at,
      quote_status: data.quote_status,
    },
  })
}

/** Registrar envio / garantir token (padrão Logistics mark_proposal_sent). */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => ({}))) as {
    action?: 'mark_sent' | 'follow_up' | 'ensure_token'
  }
  const action = body.action ?? 'mark_sent'

  const { data: quote, error: loadErr } = await loadQuote(id, companyId)
  if (loadErr) {
    return Response.json({ error: loadErr.message }, { status: 500 })
  }
  if (!quote || quote.active === false) {
    return Response.json({ error: 'Cotação não encontrada' }, { status: 404 })
  }

  const db = getSupabaseServerClient()
  let token = (quote.proposal_token as string | null) || null
  if (!token) {
    token = newProposalToken()
  }

  if (action === 'ensure_token') {
    const { error } = await db
      .from('quotes')
      .update({ proposal_token: token })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ data: { token, proposal_sent_at: quote.proposal_sent_at } })
  }

  if (action === 'follow_up') {
    const nextCount = Number(quote.proposal_follow_up_count ?? 0) + 1
    const { data, error } = await db
      .from('quotes')
      .update({
        proposal_token: token,
        proposal_last_follow_up_at: new Date().toISOString(),
        proposal_follow_up_count: nextCount,
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select(
        'proposal_token, proposal_sent_at, proposal_response, proposal_follow_up_count, proposal_last_follow_up_at, quote_status',
      )
      .single()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ data })
  }

  // mark_sent
  const sentAt =
    (quote.proposal_sent_at as string | null) || new Date().toISOString()
  const currentStatus = String(quote.quote_status ?? 'draft')
  const keepStatus = ['approved', 'cancelled', 'canceled'].includes(currentStatus)
  const response =
    quote.proposal_response === 'accepted' ? 'accepted' : 'pending'

  const { data, error } = await db
    .from('quotes')
    .update({
      proposal_token: token,
      proposal_sent_at: sentAt,
      proposal_response: response,
      quote_status: keepStatus
        ? currentStatus
        : response === 'accepted'
          ? currentStatus
          : 'sent',
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select(
      'proposal_token, proposal_sent_at, proposal_response, proposal_follow_up_count, proposal_last_follow_up_at, quote_status',
    )
    .single()

  if (error) {
    // Colunas ainda não migradas
    if (/proposal_token|column/i.test(error.message)) {
      return Response.json(
        {
          error:
            'Colunas de proposta ausentes. Aplique a migration 20260804180000_quote_proposals.sql no DEV.',
        },
        { status: 409 },
      )
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    data: {
      token: data.proposal_token,
      ...data,
    },
  })
}
