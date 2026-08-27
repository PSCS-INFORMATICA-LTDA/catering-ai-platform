import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { loadCompanyInvoice } from '@/Lib/payments/createInvoiceFromQuote'
import {
  createPaymentLinkToken,
  defaultPaymentLinkExpiry,
  hashPaymentLinkToken,
  isPaymentPurpose,
} from '@/Lib/payments/paymentLinks'
import { createInvoicePaymentLink } from '@/Lib/payments/resolvePaymentLink'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const invoice = await loadCompanyInvoice(companyId, id)
  if (!invoice) return Response.json({ error: 'not_found' }, { status: 404 })
  if (invoice.status === 'canceled' || invoice.status === 'paid') {
    return Response.json({ error: 'invoice_not_payable' }, { status: 409 })
  }

  const body = (await request.json().catch(() => null)) as {
    purpose?: string
    expires?: boolean
  } | null
  const purpose = isPaymentPurpose(body?.purpose) ? body.purpose : 'deposit'
  const rawToken = createPaymentLinkToken()
  const created = await createInvoicePaymentLink({
    companyId,
    invoiceId: invoice.id,
    purpose,
    rawToken,
    tokenHash: hashPaymentLinkToken(rawToken),
    expiresAt: body?.expires === false ? null : defaultPaymentLinkExpiry(),
    actorUserId: auth.session.userId,
  })
  if (!created.ok) {
    return Response.json({ error: created.error }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  return Response.json({
    data: {
      id: created.id,
      purpose,
      url: `${origin}/pay/${rawToken}`,
      token: rawToken,
    },
  })
}
