import {
  readPaypalWebhookHeaders,
  verifyPaypalWebhookSignature,
} from '@/Lib/payments/paypal/webhook'
import { processVerifiedPaypalCapture } from '@/Lib/payments/paypal/processWebhook'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const headers = readPaypalWebhookHeaders(request.headers)
  const verified = await verifyPaypalWebhookSignature({
    headers,
    rawBody,
  })
  if (!verified.ok) {
    return Response.json({ error: verified.reason }, { status: 400 })
  }
  return processVerifiedPaypalCapture({ rawBody })
}
