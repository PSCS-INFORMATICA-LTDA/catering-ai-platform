import type { Company } from './types'

/** Nome exibível da empresa ativa — trade_name → company_name → legal_name. */
export function resolveTenantCompanyDisplayName(
  company: Company | null | undefined,
): string | null {
  const trade = company?.trade_name?.trim()
  if (trade) return trade
  const name = company?.company_name?.trim()
  if (name) return name
  const legal = company?.legal_name?.trim()
  if (legal) return legal
  return null
}

/** Header/chrome: tenant company first, then the matching session membership name. */
export function resolveHeaderCompanyDisplayName(input: {
  company?: Company | null
  companyId?: string | null
  memberships?: Array<{ companyId: string; companyName: string | null }> | null
}): string | null {
  const fromTenant = resolveTenantCompanyDisplayName(input.company)
  if (fromTenant) return fromTenant
  const companyId = input.companyId?.trim() || input.company?.id?.trim() || ''
  if (!companyId) return null
  const match = (input.memberships ?? []).find((row) => row.companyId === companyId)
  return match?.companyName?.trim() || null
}
