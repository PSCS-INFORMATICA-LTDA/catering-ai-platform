import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { convertAcceptedQuoteToServiceOrder } from '@/Lib/orders/convertAcceptedQuoteToServiceOrder'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

/** Converte cotação aceita em Ordem de Serviço (manual, idempotente). */
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.convert')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  const { data, error } = await convertAcceptedQuoteToServiceOrder({
    companyId,
    quoteId: id,
    actorUserId: auth.session.userId,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 500 })
  }

  return Response.json({ data })
}
