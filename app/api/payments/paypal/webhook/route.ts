export const dynamic = 'force-dynamic'

/**
 * Legacy unscoped webhook endpoint is intentionally closed.
 * Company-scoped PayPal webhooks must use /api/payments/paypal/webhook/[connectionKey].
 */
export async function POST() {
  return Response.json({ error: 'paypal_webhook_scoped_route_required' }, { status: 410 })
}
