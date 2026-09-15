import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { loadPublicProposalByToken } from '@/Lib/commercialReview/loadPublicProposal'
import { quoteHasPendingCoupon } from '@/Lib/coupons/resolveCoupon'
import { loadPublicProposalPaymentSnapshot } from '@/Lib/payments/publicProposalPayment'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

async function withPayment(
  loaded: Awaited<ReturnType<typeof loadPublicProposalByToken>>,
) {
  if (!loaded.ok) return loaded.payload
  const quote = loaded.payload.quote as
    | { quote_status?: string | null }
    | undefined
  const payment = await loadPublicProposalPaymentSnapshot({
    companyId: loaded.companyId,
    quoteId: loaded.quoteId,
    proposalResponse: String(loaded.payload.proposal_response || 'pending'),
    quoteStatus: quote?.quote_status ?? null,
  })
  return { ...loaded.payload, payment }
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const loaded = await loadPublicProposalByToken(token)
  const payload = await withPayment(loaded)
  return Response.json(payload, { status: loaded.status })
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
  const trimmed = token.trim()
  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, proposal_sent_at, proposal_response, quote_status, active, proposal_shared_version_id, accepted_version_id',
    )
    .eq('proposal_token', trimmed)
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

  const alreadyAccepted = quote.proposal_response === 'accepted'
  if (alreadyAccepted && body.action === 'accept') {
    const payment = await loadPublicProposalPaymentSnapshot({
      companyId: quote.company_id,
      quoteId: quote.id,
      proposalResponse: 'accepted',
      quoteStatus: quote.quote_status,
    })
    return Response.json({
      data: {
        proposal_response: 'accepted',
        quote_status: quote.quote_status,
        proposal_shared_version_id: quote.proposal_shared_version_id,
        accepted_version_id: quote.accepted_version_id,
        already_accepted: true,
        payment,
      },
    })
  }

  if (quote.proposal_response !== 'pending') {
    return Response.json({ error: 'Proposta já respondida' }, { status: 409 })
  }

  if (body.action === 'accept') {
    const pendingCoupon = await quoteHasPendingCoupon(quote.company_id, quote.id)
    if (!pendingCoupon.ok) {
      return Response.json({ error: 'coupon_approval_check_failed' }, { status: 500 })
    }
    if (pendingCoupon.pending) {
      return Response.json({ error: 'coupon_approval_pending' }, { status: 409 })
    }
  }

  const now = new Date().toISOString()
  const sharedVersionId =
    (quote.proposal_shared_version_id as string | null) ?? null
  const patch: Record<string, unknown> =
    body.action === 'accept'
      ? {
          proposal_response: 'accepted',
          proposal_accepted_at: now,
          quote_status: 'approved',
          ...(sharedVersionId ? { accepted_version_id: sharedVersionId } : {}),
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
    .select(
      'proposal_response, quote_status, proposal_shared_version_id, accepted_version_id',
    )
    .single()

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId: quote.company_id,
    actorUserId: null,
    entityType: 'quote_proposal',
    entityId: quote.id,
    action: 'proposal_responded',
    newData: {
      quote_id: quote.id,
      action: body.action,
      proposal_shared_version_id: sharedVersionId,
      accepted_version_id:
        body.action === 'accept' ? sharedVersionId : null,
    },
  })

  const payment =
    body.action === 'accept'
      ? await loadPublicProposalPaymentSnapshot({
          companyId: quote.company_id,
          quoteId: quote.id,
          proposalResponse: 'accepted',
          quoteStatus: data?.quote_status ?? 'approved',
        })
      : emptyRejectedPayment()

  return Response.json({
    data: {
      ...data,
      proposal_shared_version_id:
        data?.proposal_shared_version_id ?? sharedVersionId,
      payment,
    },
  })
}

function emptyRejectedPayment() {
  return {
    available: false,
    reason: 'proposal_rejected',
    currency_code: 'USD',
    total: 0,
    paid_total: 0,
    deposit_percent: 0,
    balance_percent: 0,
    choices: [],
  }
}
