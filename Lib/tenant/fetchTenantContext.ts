import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { Branch, Company, FeatureFlagKey, TenantContext } from './types'
import {
  getActiveBranchIdFromEnv,
  getActiveCompanyId,
  getActiveRoleFromEnv,
} from './resolveTenant'

export async function fetchTenantContext(options?: {
  companyId?: string
  branchId?: string | null
}): Promise<TenantContext> {
  const companyId = options?.companyId?.trim() || getActiveCompanyId()
  const envBranchId = options?.branchId ?? getActiveBranchIdFromEnv()
  const supabase = getSupabaseServerClient()

  const companyColumnsBase =
    'id, franchise_group_id, company_name, company_code, legal_name, trade_name, slug, currency_code, default_language, timezone, subscription_status, google_calendar_enabled, google_calendar_id, google_calendar_timezone, active'
  const companyColumnsWithLogo = `${companyColumnsBase}, logo_url, brand_logo_url`

  let companyRes = await supabase
    .from('companies')
    .select(companyColumnsWithLogo)
    .eq('id', companyId)
    .maybeSingle()

  if (
    companyRes.error &&
    /logo_url|brand_logo_url|schema cache/i.test(companyRes.error.message)
  ) {
    companyRes = await supabase
      .from('companies')
      .select(companyColumnsBase)
      .eq('id', companyId)
      .maybeSingle()
  }

  const [branchesRes, flagsRes] = await Promise.all([
    supabase
      .from('branches')
      .select(
        'id, company_id, name, slug, branch_code, city, state, country, timezone, google_calendar_enabled, google_calendar_id, service_radius_miles, mileage_fee_per_mile, active',
      )
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('feature_flags')
      .select('feature_key, enabled')
      .eq('company_id', companyId),
  ])

  const company = (companyRes.data as Company | null) ?? null
  const branches = (branchesRes.data ?? []) as Branch[]

  let branchId = envBranchId
  if (!branchId && branches.length === 1) {
    branchId = branches[0]!.id
  }

  const branch =
    branchId != null
      ? branches.find((row) => row.id === branchId) ?? null
      : null

  const featureFlags: Record<string, boolean> = {}
  for (const row of flagsRes.data ?? []) {
    featureFlags[String(row.feature_key)] = Boolean(row.enabled)
  }

  return {
    companyId,
    company,
    branchId: branch?.id ?? branchId,
    branch,
    branches,
    role: getActiveRoleFromEnv(),
    featureFlags: featureFlags as Partial<Record<FeatureFlagKey, boolean>>,
  }
}
