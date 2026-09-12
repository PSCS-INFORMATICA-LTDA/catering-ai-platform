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
  if (!connectionKey || connectionKey.length < 24) {
    return Response.json({ error: 'webhook_unknown' }, { status: 404 })
  }

  const provider = await findPaypalProviderByWebhookKey(connectionKey)
  if (!provider) return Response.json({ error: 'webhook_unknown' }, { status: 404 })
  if (provider.environment === 'live') {
    return Response.json({ error: 'paypal_live_blocked' }, { status: 403 })
  }

  const creds = await loadCompanyPaypalCredentials(String(provider.company_id))
  if (!creds.clientId || !creds.clientSecret || !creds.webhookId) {
    return Response.json({ error: 'paypal_webhook_not_configured' }, { status: 409 })
  }

  const token = await getPaypalSandboxAccessToken({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  })
  if (!token) {
    return Response.json({ error: 'paypal_sandbox_auth_failed' }, { status: 502 })
  }

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
