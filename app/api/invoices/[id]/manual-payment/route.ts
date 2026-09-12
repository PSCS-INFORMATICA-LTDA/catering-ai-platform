import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { recordManualPayment } from '@/Lib/payments/manualFinance'
import type { PaymentPurpose } from '@/Lib/payments/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

function isPurpose(value: unknown): value is PaymentPurpose {
  return value === 'deposit' || value === 'balance' || value === 'full'
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.payments.reconcile')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => null)) as {
    provider?: string
    purpose?: string
    confirmationReference?: string
    confirmationNote?: string
  } | null

  if (body?.provider !== 'zelle' && body?.provider !== 'bank_transfer') {
    return Response.json({ error: 'invalid_manual_provider' }, { status: 400 })
  }
  if (!isPurpose(body?.purpose)) {
    return Response.json({ error: 'invalid_purpose' }, { status: 400 })
  }

  const result = await recordManualPayment({
    companyId,
    invoiceId: id,
    provider: body.provider,
    purpose: body.purpose,
    confirmationReference: body.confirmationReference || '',
    confirmationNote: body.confirmationNote || null,
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    return Response.json(
      { error: result.error, refundable: 'refundable' in result ? result.refundable : undefined },
      { status: result.status },
    )
  }

  return Response.json({ data: result })
}
