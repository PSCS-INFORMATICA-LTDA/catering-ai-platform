import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { convertAcceptedQuoteToServiceOrder } from '@/Lib/orders/convertAcceptedQuoteToServiceOrder'
import { fetchServiceOrderList } from '@/Lib/orders/fetchServiceOrderList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireApiPermission('orders.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await fetchServiceOrderList(companyId)

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }

  return Response.json(
    { data: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

/**
 * Não existe criação livre de Ordem de Serviço nesta fundação (ADR §1/§4):
 * a OS nasce exclusivamente da conversão de uma cotação aceita. Este POST é
 * um atalho equivalente a `POST /api/quotes/[id]/convert`.
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission('quotes.convert')
  if (!auth.ok) return auth.response

  let body: { quote_id?: string }
  try {
    body = (await request.json()) as { quote_id?: string }
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const quoteId = body.quote_id?.trim()
  if (!quoteId) {
    return Response.json({ error: 'quote_id é obrigatório.' }, { status: 400 })
  }

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await convertAcceptedQuoteToServiceOrder({
    companyId,
    quoteId,
    actorUserId: auth.session.userId,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 500 })
  }

  return Response.json({ data }, { status: 201 })
}
