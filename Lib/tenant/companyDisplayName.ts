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
