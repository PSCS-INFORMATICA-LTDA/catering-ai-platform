import CompanySettingsDashboard from '@/components/settings/CompanySettingsDashboard'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { tCompanySettings } from '@/Lib/i18n/companySettings'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CompanySettingsPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/settings/company')

  const companyId = resolveAuthorizedCompanyId(session)
  const { data, error } = await getSupabaseServerClient()
    .from('companies')
    .select(
      'id, company_name, legal_name, trade_name, document, state_registration, postal_code, street, address_number, address_complement, neighborhood, city, state, address, phone, billing_email, website, logo_url, brand_logo_url, active',
    )
    .eq('id', companyId)
    .maybeSingle()

  const locale = resolveAuthLocale(session.appUser?.preferred_language)

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold text-red-500">
          {tCompanySettings(locale, 'loadError')}
        </h1>
        <pre className="mt-3 text-sm">{error.message}</pre>
        <p className="mt-3 text-sm text-cdl-muted">
          {tCompanySettings(locale, 'loadErrorHint')}
        </p>
      </main>
    )
  }

  return <CompanySettingsDashboard initialCompany={data} />
}
