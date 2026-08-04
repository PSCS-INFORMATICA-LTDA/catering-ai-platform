import CompanySettingsDashboard from '@/components/settings/CompanySettingsDashboard'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
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

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold text-red-500">Erro ao carregar empresa</h1>
        <pre className="mt-3 text-sm">{error.message}</pre>
        <p className="mt-3 text-sm text-cdl-muted">
          Aplique a migration DEV `20260804140000_company_profile_address_logo.sql`
          se as colunas de endereço ainda não existirem.
        </p>
      </main>
    )
  }

  return <CompanySettingsDashboard initialCompany={data} />
}
