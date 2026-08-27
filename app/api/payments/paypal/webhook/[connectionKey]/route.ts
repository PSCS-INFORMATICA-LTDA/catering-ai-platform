import { findPaypalProviderByWebhookKey, loadCompanyPaypalCredentials } from '@/Lib/payments/companyPaypal'
import { getPaypalSandboxAccessToken } from '@/Lib/payments/paypal/adapter'
import { processVerifiedPaypalCapture } from '@/Lib/payments/paypal/processWebhook'
import {
  readPaypalWebhookHeaders,
  verifyPaypalWebhookSignature,
} from '@/Lib/payments/paypal/webhook'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionKey: string }> },
) {
  const { connectionKey } = await params
  const provider = await findPaypalProviderByWebhookKey(connectionKey)
  if (!provider) {
    return Response.json({ error: 'webhook_unknown' }, { status: 404 })
  }
  const creds = await loadCompanyPaypalCredentials(String(provider.company_id))
  const token = await getPaypalSandboxAccessToken({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  })
  const rawBody = await request.text()
  const verified = await verifyPaypalWebhookSignature({
    headers: readPaypalWebhookHeaders(request.headers),
    rawBody,
    webhookId: creds.webhookId,
    accessToken: token,
  })
  if (!verified.ok) {
    return Response.json({ error: verified.reason }, { status: 400 })
  }
  return processVerifiedPaypalCapture({
    rawBody,
    expectedCompanyId: String(provider.company_id),
  })
}
