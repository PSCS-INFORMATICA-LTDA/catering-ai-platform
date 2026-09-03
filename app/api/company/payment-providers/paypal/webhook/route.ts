import { requireApiPermission, requireSessionCompanyId } from '@/Lib/auth/requireApi'
import {
  createWebhookRouteKey,
  loadCompanyPaypalCredentials,
  loadCompanyPaypalRow,
  PAYMENT_SETTINGS_PERMISSION,
  publicPaypalWebhookUrl,
} from '@/Lib/payments/companyPaypal'
import { getPaypalSandboxAccessToken } from '@/Lib/payments/paypal/adapter'
import { findOrCreateSandboxWebhook } from '@/Lib/payments/paypal/sandboxWebhooks'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST() {
  const auth = await requireApiPermission(PAYMENT_SETTINGS_PERMISSION)
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const creds = await loadCompanyPaypalCredentials(company.companyId)
  if (!creds.clientId || !creds.clientSecret) {
    return Response.json({ error: 'paypal_not_configured' }, { status: 409 })
  }

  const existing = await loadCompanyPaypalRow(company.companyId)
  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) || {}),
  }
  if (metadata.connection_status !== 'validated') {
    return Response.json({ error: 'paypal_test_required' }, { status: 409 })
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

  const ensured = await findOrCreateSandboxWebhook({
    accessToken: token,
    url: webhookUrl,
  })
  if (!ensured) {
    return Response.json({ error: 'paypal_webhook_create_failed' }, { status: 502 })
  }

  metadata.webhook_id = ensured.id
  await getSupabaseServerClient()
    .from('company_payment_providers')
    .update({
      webhook_route_key: routeKey,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', company.companyId)
    .eq('provider', 'paypal')

  await writeOperationalAudit({
    companyId: company.companyId,
    actorUserId: auth.session.userId,
    entityType: 'company_payment_provider',
    entityId: company.companyId,
    action: 'paypal_webhook_configured',
    newData: { webhookConfigured: true, reused: ensured.reused },
  })

  return Response.json({
    data: {
      webhookId: ensured.id,
      webhookUrl,
      reused: ensured.reused,
    },
  })
}
