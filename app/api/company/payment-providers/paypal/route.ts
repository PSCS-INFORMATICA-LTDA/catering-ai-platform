import {
  rejectSpoofedTenantCompanyId,
  requireApiPermission,
  requireSessionCompanyId,
} from '@/Lib/auth/requireApi'
import {
  createWebhookRouteKey,
  ensurePaypalWebhookRouteKey,
  loadCompanyPaypalRow,
  PAYMENT_SETTINGS_PERMISSION,
  toPublicPaypalSettings,
  type CompanyPaypalMetadata,
} from '@/Lib/payments/companyPaypal'
import {
  ensureOfflineMethods,
  loadCompanyPaymentMethods,
} from '@/Lib/payments/companyProviders'
import { storeCompanyPaypalSecret } from '@/Lib/payments/secretVault'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireApiPermission(PAYMENT_SETTINGS_PERMISSION)
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const spoofed = rejectSpoofedTenantCompanyId(
    company.companyId,
    new URL(request.url).searchParams.get('company_id'),
  )
  if (spoofed) return spoofed
  await ensureOfflineMethods(company.companyId)
  await ensurePaypalWebhookRouteKey(company.companyId)
  const data = await toPublicPaypalSettings(company.companyId)
  const methods = await loadCompanyPaymentMethods(company.companyId)
  return Response.json({ data, methods })
}

export async function PUT(request: Request) {
  const auth = await requireApiPermission(PAYMENT_SETTINGS_PERMISSION)
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const body = (await request.json().catch(() => null)) as {
    company_id?: string
    environment?: string
    enabled?: boolean
    clientId?: string
    clientSecret?: string
  } | null
  const spoofed = rejectSpoofedTenantCompanyId(company.companyId, body?.company_id)
  if (spoofed) return spoofed
  if (body?.environment === 'live') {
    return Response.json({ error: 'paypal_live_blocked' }, { status: 403 })
  }

  const existing = await loadCompanyPaypalRow(company.companyId)
  const metadata = (existing?.metadata || {}) as CompanyPaypalMetadata
  const routeKey = existing?.webhook_route_key || createWebhookRouteKey()
  const clientId =
    typeof body?.clientId === 'string' ? body.clientId.trim() : existing?.public_client_id
  const secret = typeof body?.clientSecret === 'string' ? body.clientSecret.trim() : ''

  if (secret) {
    const stored = await storeCompanyPaypalSecret(company.companyId, secret)
    metadata.client_secret_vault_id = stored.id
  }

  if (clientId && (secret || metadata.client_secret_vault_id)) {
    metadata.connection_status =
      metadata.connection_status === 'validated' ? 'validated' : 'configured'
  } else {
    metadata.connection_status = 'not_configured'
  }

  const { error } = await getSupabaseServerClient()
    .from('company_payment_providers')
    .upsert(
      {
        company_id: company.companyId,
        provider: 'paypal',
        environment: 'sandbox',
        enabled: body?.enabled === true,
        public_client_id: clientId || null,
        webhook_route_key: routeKey,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,provider' },
    )
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId: company.companyId,
    actorUserId: auth.session.userId,
    entityType: 'company_payment_provider',
    entityId: company.companyId,
    action: 'paypal_provider_config_updated',
    newData: {
      enabled: body?.enabled === true,
      clientIdConfigured: Boolean(clientId),
      secretUpdated: Boolean(secret),
    },
  })

  return Response.json({ data: await toPublicPaypalSettings(company.companyId) })
}
