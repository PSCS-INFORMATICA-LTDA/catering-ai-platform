import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { completeInvoiceRefund } from '@/Lib/payments/manualFinance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string; refundId: string }> }

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.refunds.manage')
  if (!auth.ok) return auth.response

  const { id, refundId } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => null)) as {
    providerRefundId?: string
  } | null

  const result = await completeInvoiceRefund({
    companyId,
    invoiceId: id,
    refundId,
    providerRefundId: body?.providerRefundId || '',
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({ data: result })
}
