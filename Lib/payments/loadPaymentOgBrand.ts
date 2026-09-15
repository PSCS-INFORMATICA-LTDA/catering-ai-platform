import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { resolveTenantCompanyDisplayName } from '@/Lib/tenant/companyDisplayName'
import type { Company } from '@/Lib/tenant/types'
import { paymentOgDescription } from './paymentOgCopy'
import { resolvePaymentLink } from './resolvePaymentLink'

export { companyLogoStoragePath } from './paymentOgCopy'

export type PaymentOgBrand = {
  companyId: string | null
  displayName: string
  logoUrl: string | null
  locale: 'pt' | 'en' | 'es'
  description: string
}

const FALLBACK_NAME = 'Catering AI'

export async function loadCompanyOgBrand(
  companyId: string,
  locale?: string | null,
): Promise<PaymentOgBrand> {
  const supabase = getSupabaseServerClient()
  const { data } = await supabase
    .from('companies')
    .select('id, company_name, trade_name, legal_name, logo_url, brand_logo_url')
    .eq('id', companyId)
    .maybeSingle()

  const company = (data || null) as Company | null
  const displayName = resolveTenantCompanyDisplayName(company) || FALLBACK_NAME
  const logoUrl =
    company?.brand_logo_url?.trim() || company?.logo_url?.trim() || null

  return {
    companyId: company?.id || companyId || null,
    displayName,
    logoUrl,
    locale: locale === 'en' || locale === 'es' ? locale : 'pt',
    description: paymentOgDescription(locale),
  }
}

export async function loadPaymentOgBrandFromToken(
  token: string,
  locale?: string | null,
): Promise<PaymentOgBrand> {
  const resolved = await resolvePaymentLink(token)
  if (!resolved.ok) {
    return {
      companyId: null,
      displayName: FALLBACK_NAME,
      logoUrl: null,
      locale: 'pt',
      description: paymentOgDescription(locale || 'pt'),
    }
  }
  const invoiceLocale =
    locale === 'en' || locale === 'es' || locale === 'pt'
      ? locale
      : resolved.invoice.locale
  return loadCompanyOgBrand(resolved.invoice.company_id, invoiceLocale)
}
