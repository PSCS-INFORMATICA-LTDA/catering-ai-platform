import {
  rejectSpoofedTenantCompanyId,
  requireApiPermission,
  requireSessionCompanyId,
} from '@/Lib/auth/requireApi'
import { PAYMENT_SETTINGS_PERMISSION } from '@/Lib/payments/companyPaypal'
import { loadCompanyOfflinePaymentSettings } from '@/Lib/payments/companyProviders'
import { buildOfflineMetadata, cleanOfflineField } from '@/Lib/payments/offlinePaymentMetadata'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  const auth = await requireApiPermission(PAYMENT_SETTINGS_PERMISSION)
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const body = (await request.json().catch(() => null)) as {
    company_id?: string; zelle?: Record<string, unknown>; bankTransfer?: Record<string, unknown>
  } | null
  const spoofed = rejectSpoofedTenantCompanyId(company.companyId, body?.company_id)
  if (spoofed) return spoofed
  if (!body?.zelle || typeof body.zelle !== 'object' || Array.isArray(body.zelle) ||
      !body.bankTransfer || typeof body.bankTransfer !== 'object' || Array.isArray(body.bankTransfer)) {
    return Response.json({ error: 'offline_payment_settings_invalid' }, { status: 400 })
  }
  const zelle = body.zelle
  const bank = body.bankTransfer
  const supabase = getSupabaseServerClient()
  const { data: existing, error: readError } = await supabase
    .from('company_payment_providers').select('provider, metadata')
    .eq('company_id', company.companyId).in('provider', ['zelle', 'bank_transfer'])
  if (readError) return Response.json({ error: 'offline_payment_settings_read_failed' }, { status: 500 })
  const metadata = buildOfflineMetadata(zelle, bank,
    existing?.find((row) => row.provider === 'zelle')?.metadata,
    existing?.find((row) => row.provider === 'bank_transfer')?.metadata)
  const rows = [
    { company_id: company.companyId, provider: 'zelle', environment: 'sandbox',
      enabled: zelle.enabled === true, public_client_id: null, metadata: metadata.zelle, updated_at: new Date().toISOString() },
    { company_id: company.companyId, provider: 'bank_transfer', environment: 'sandbox',
      enabled: bank.enabled === true, public_client_id: null, metadata: metadata.bankTransfer, updated_at: new Date().toISOString() },
  ]
  const { error } = await supabase.from('company_payment_providers').upsert(rows, { onConflict: 'company_id,provider' })
  if (error) return Response.json({ error: 'offline_payment_settings_save_failed' }, { status: 500 })
  await writeOperationalAudit({
    companyId: company.companyId, actorUserId: auth.session.userId,
    entityType: 'company_payment_provider', entityId: company.companyId,
    action: 'offline_payment_settings_updated',
    newData: {
      zelleEnabled: zelle.enabled === true, bankTransferEnabled: bank.enabled === true,
      zelleConfigured: Boolean(cleanOfflineField(zelle.recipientContact)),
      bankTransferConfigured: Boolean(cleanOfflineField(bank.accountNumber)),
    },
  })
  return Response.json({ data: await loadCompanyOfflinePaymentSettings(company.companyId) })
}
