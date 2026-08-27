import { requireApiPermission, requireSessionCompanyId } from '@/Lib/auth/requireApi'
import {
  loadCompanyPaypalCredentials,
  loadCompanyPaypalRow,
  PAYMENT_SETTINGS_PERMISSION,
} from '@/Lib/payments/companyPaypal'
import { getPaypalSandboxAccessToken } from '@/Lib/payments/paypal/adapter'
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

  const token = await getPaypalSandboxAccessToken({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  })
  const ok = Boolean(token)
  const existing = await loadCompanyPaypalRow(company.companyId)
  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) || {}),
    connection_status: ok ? 'validated' : 'error',
    last_tested_at: new Date().toISOString(),
    last_test_status: ok ? 'sandbox_ok' : 'sandbox_auth_failed',
    last_test_error: ok ? null : 'paypal_sandbox_auth_failed',
  }
  await getSupabaseServerClient()
    .from('company_payment_providers')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('company_id', company.companyId)
    .eq('provider', 'paypal')

  await writeOperationalAudit({
    companyId: company.companyId,
    actorUserId: auth.session.userId,
    entityType: 'company_payment_provider',
    entityId: company.companyId,
    action: 'paypal_connection_tested',
    newData: { ok, environment: 'sandbox' },
  })

  if (!ok) {
    return Response.json(
      { error: 'paypal_sandbox_auth_failed', data: { connectionStatus: 'error' } },
      { status: 502 },
    )
  }
  return Response.json({
    data: {
      ok: true,
      message: 'Conexão PayPal Sandbox validada',
      connectionStatus: 'validated',
    },
  })
}
