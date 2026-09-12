import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { requestInvoiceCancellation } from '@/Lib/payments/manualFinance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.invoices.cancel')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => null)) as {
    reason?: string
  } | null

  const result = await requestInvoiceCancellation({
    companyId,
    invoiceId: id,
    reason: body?.reason || '',
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({ data: result })
}
