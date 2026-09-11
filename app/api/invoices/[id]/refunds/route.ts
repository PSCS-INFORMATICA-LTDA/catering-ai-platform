import { randomUUID } from 'node:crypto'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { requestInvoiceRefund } from '@/Lib/payments/manualFinance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.refunds.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => null)) as {
    paymentId?: string
    amount?: number
    reason?: string
    idempotencyKey?: string
  } | null

  if (!body?.paymentId) {
    return Response.json({ error: 'payment_required' }, { status: 400 })
  }

  const result = await requestInvoiceRefund({
    companyId,
    invoiceId: id,
    paymentId: body.paymentId,
    amount: body.amount ?? null,
    reason: body.reason || '',
    actorUserId: auth.session.userId,
    idempotencyKey:
      body.idempotencyKey || request.headers.get('Idempotency-Key') || randomUUID(),
  })

  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
        refundable: 'refundable' in result ? result.refundable : undefined,
      },
      { status: result.status },
    )
  }

  return Response.json({ data: result })
}
