import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { confirmQuoteDepositAndReserveSchedule } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const result = await confirmQuoteDepositAndReserveSchedule({
    companyId,
    quoteId: id,
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    return Response.json(
      {
        error: result.error ?? 'Não foi possível confirmar o sinal.',
        conflict: result.conflict,
      },
      { status: result.status ?? 400 },
    )
  }

  return Response.json({
    data: {
      reservation_confirmed_at: result.reservation_confirmed_at,
      already_confirmed: result.already_confirmed === true,
      agenda_event_id: result.agenda_event_id,
      agenda_status: result.agenda_status,
    },
  })
}
