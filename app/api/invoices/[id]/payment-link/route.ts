import { hasPermission } from '@/Lib/auth/permissions'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { loadCompanyInvoice } from '@/Lib/payments/createInvoiceFromQuote'
import { createPayablePaymentLink } from '@/Lib/payments/createPayablePaymentLink'
import { isPaymentPurpose } from '@/Lib/payments/paymentLinks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.invoices.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const invoice = await loadCompanyInvoice(companyId, id)
  if (!invoice) return Response.json({ error: 'not_found' }, { status: 404 })

  const canCreateOriginalLink =
    auth.session.isPlatformAdmin ||
    hasPermission(auth.session.permissions, 'quotes.manage')
  const canCreateSupplementalLink =
    auth.session.isPlatformAdmin ||
    hasPermission(auth.session.permissions, 'finance.adjustments.manage')
  if (
    (invoice.invoice_kind === 'post_event_adjustment' && !canCreateSupplementalLink) ||
    (invoice.invoice_kind !== 'post_event_adjustment' && !canCreateOriginalLink)
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    purpose?: string
    expires?: boolean
  } | null
  const defaultPurpose = invoice.deposit_amount <= 0 ? 'full' : 'deposit'
  const purpose = isPaymentPurpose(body?.purpose) ? body.purpose : defaultPurpose
  const created = await createPayablePaymentLink({
    companyId,
    invoiceId: invoice.id,
    purpose,
    origin: new URL(request.url).origin,
    actorUserId: auth.session.userId,
    expires: body?.expires,
  })
  if (!created.ok) {
    return Response.json(
      {
        error: created.error,
        deposit_due: created.deposit_due,
        balance_due: created.balance_due,
        full_due: created.full_due,
        available_at: created.available_at ?? null,
      },
      { status: created.status },
    )
  }

  return Response.json({
    data: {
      id: created.id,
      purpose: created.purpose,
      url: created.url,
      token: created.token,
      amount: created.amount,
      currency: created.currency,
      deposit_due: created.deposit_due,
      balance_due: created.balance_due,
      full_due: created.full_due,
    },
  })
}
