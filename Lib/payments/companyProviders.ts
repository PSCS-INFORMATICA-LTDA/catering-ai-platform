import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { readPaypalRuntimeConfig } from './paypal/config'
import type { PaymentProvider } from './types'

export type CompanyPaymentProvider = {
  companyId: string
  provider: PaymentProvider
  environment: 'sandbox' | 'live'
  enabled: boolean
  publicClientId: string | null
}

export async function loadCompanyPaymentProvider(
  companyId: string,
  provider: PaymentProvider,
): Promise<CompanyPaymentProvider | null> {
  const { data } = await getSupabaseServerClient()
    .from('company_payment_providers')
    .select('company_id, provider, environment, enabled, public_client_id')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle()
  if (!data) return null
  return {
    companyId: String(data.company_id),
    provider: data.provider as PaymentProvider,
    environment: data.environment === 'live' ? 'live' : 'sandbox',
    enabled: data.enabled === true,
    publicClientId: data.public_client_id ? String(data.public_client_id) : null,
  }
}

export async function assertCompanyPaypalEligible(companyId: string) {
  const runtime = readPaypalRuntimeConfig()
  if (runtime.liveBlocked) return { ok: false as const, error: 'paypal_live_blocked' }
  if (!runtime.enabled) return { ok: false as const, error: 'paypal_disabled' }
  const company = await loadCompanyPaymentProvider(companyId, 'paypal')
  if (!company) return { ok: false as const, error: 'paypal_not_configured' }
  if (!company.enabled) return { ok: false as const, error: 'paypal_company_disabled' }
  if (company.environment === 'live') {
    return { ok: false as const, error: 'paypal_live_blocked' }
  }
  return { ok: true as const, company, runtime }
}

export async function loadCompanyPaymentMethods(companyId: string) {
  const { data } = await getSupabaseServerClient()
    .from('company_payment_providers')
    .select('provider, enabled, environment')
    .eq('company_id', companyId)
  const rows = data ?? []
  return {
    zelle: rows.some((row) => row.provider === 'zelle' && row.enabled === true),
    bankTransfer: rows.some(
      (row) => row.provider === 'bank_transfer' && row.enabled === true,
    ),
  }
}

export async function ensureOfflineMethods(companyId: string) {
  const supabase = getSupabaseServerClient()
  await supabase.from('company_payment_providers').upsert(
    [
      {
        company_id: companyId,
        provider: 'zelle',
        environment: 'sandbox',
        enabled: true,
        public_client_id: null,
      },
      {
        company_id: companyId,
        provider: 'bank_transfer',
        environment: 'sandbox',
        enabled: true,
        public_client_id: null,
      },
    ],
    { onConflict: 'company_id,provider' },
  )
}
