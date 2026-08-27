import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  createWebhookRouteKey,
  loadCompanyPaypalCredentials,
  loadCompanyPaypalRow,
  publicPaypalWebhookUrl,
} from '@/Lib/payments/companyPaypal'
import { getPaypalSandboxAccessToken } from '@/Lib/payments/paypal/adapter'
import { paypalApiBase } from '@/Lib/payments/paypal/config'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST() {
  const auth = await requireApiPermission('company.settings')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const creds = await loadCompanyPaypalCredentials(companyId)
  if (!creds.clientId || !creds.clientSecret) {
    return Response.json({ error: 'paypal_not_configured' }, { status: 409 })
  }

  const existing = await loadCompanyPaypalRow(companyId)
  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) || {}),
  }
  if (metadata.connection_status !== 'validated') {
    return Response.json({ error: 'paypal_test_required' }, { status: 409 })
  }
  if (typeof metadata.webhook_id === 'string' && metadata.webhook_id) {
    return Response.json({
      data: {
        webhookId: metadata.webhook_id,
        webhookUrl: publicPaypalWebhookUrl(existing?.webhook_route_key || creds.webhookRouteKey),
        reused: true,
      },
    })
  }

  const routeKey = existing?.webhook_route_key || createWebhookRouteKey()
  const webhookUrl = publicPaypalWebhookUrl(routeKey)
  const token = await getPaypalSandboxAccessToken({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  })
  if (!token || !webhookUrl) {
    return Response.json({ error: 'paypal_sandbox_auth_failed' }, { status: 502 })
  }

  const response = await fetch(`${paypalApiBase('sandbox')}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }],
    }),
  })
  const payload = (await response.json().catch(() => null)) as { id?: string } | null
  if (!response.ok || !payload?.id) {
    return Response.json({ error: 'paypal_webhook_create_failed' }, { status: 502 })
  }

  metadata.webhook_id = payload.id
  await getSupabaseServerClient()
    .from('company_payment_providers')
    .update({
      webhook_route_key: routeKey,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('provider', 'paypal')

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'company_payment_provider',
    entityId: companyId,
    action: 'paypal_webhook_configured',
    newData: { webhookConfigured: true },
  })

  return Response.json({
    data: {
      webhookId: payload.id,
      webhookUrl,
      reused: false,
    },
  })
}
