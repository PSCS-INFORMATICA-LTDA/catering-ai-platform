import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { loadPublicProposalByToken } from '@/Lib/commercialReview/loadPublicProposal'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const loaded = await loadPublicProposalByToken(token)
  return Response.json(loaded.payload, { status: loaded.status })
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
  if (quote.proposal_response !== 'pending') {
    return Response.json({ error: 'Proposta já respondida' }, { status: 409 })
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

  return Response.json({
    data: {
      ...data,
      proposal_shared_version_id:
        data?.proposal_shared_version_id ?? sharedVersionId,
    },
  })
}
