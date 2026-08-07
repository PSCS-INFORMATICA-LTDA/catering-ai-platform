import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()
  const userId = auth.session.userId

  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, proposal_response, quote_status, reservation_confirmed_at, active',
    )
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!quote) {
    return Response.json({ error: 'Cotação não encontrada' }, { status: 404 })
  }

  const accepted =
    quote.proposal_response === 'accepted' ||
    quote.quote_status === 'approved' ||
    quote.quote_status === 'accepted'
  if (!accepted) {
    return Response.json(
      {
        error:
          'Só é possível confirmar o sinal após o aceite da cotação pelo cliente.',
      },
      { status: 409 },
    )
  }

  if (quote.reservation_confirmed_at) {
    return Response.json({
      data: {
        reservation_confirmed_at: quote.reservation_confirmed_at,
        already_confirmed: true,
      },
    })
  }

  const confirmedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await db
    .from('quotes')
    .update({
      reservation_confirmed_at: confirmedAt,
      reservation_confirmed_by: userId,
      updated_at: confirmedAt,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id, reservation_confirmed_at, reservation_confirmed_by')
    .maybeSingle()

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: userId,
    entityType: 'quote',
    entityId: id,
    action: 'reservation_confirmed',
    newData: {
      quote_number: quote.quote_number,
      reservation_confirmed_at: confirmedAt,
    },
  })

  return Response.json({
    data: {
      ...updated,
      already_confirmed: false,
    },
  })
}
