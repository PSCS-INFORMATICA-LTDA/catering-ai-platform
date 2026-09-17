import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  parseAssistantPersonaRule,
  type CompanyPublicBrandInput,
} from './companyPublicBrand'

export async function loadCompanyAssistantBrand(
  companyId: string,
): Promise<CompanyPublicBrandInput> {
  const trimmed = companyId.trim()
  if (!trimmed) return {}

  try {
    const db = getSupabaseServerClient()
    const [companyRes, ruleRes] = await Promise.all([
      db
        .from('companies')
        .select('company_name, trade_name, legal_name, city, state, logo_url')
        .eq('id', trimmed)
        .maybeSingle(),
      db
        .from('commercial_rules')
        .select('rule_value')
        .eq('company_id', trimmed)
        .eq('rule_key', 'assistant_persona')
        .eq('active', true)
        .maybeSingle(),
    ])

    const company = (companyRes.data ?? {}) as Record<string, unknown>
    const persona = parseAssistantPersonaRule(ruleRes.data?.rule_value)
    return {
      companyName: typeof company.company_name === 'string' ? company.company_name : null,
      tradeName: typeof company.trade_name === 'string' ? company.trade_name : null,
      legalName: typeof company.legal_name === 'string' ? company.legal_name : null,
      city: typeof company.city === 'string' ? company.city : null,
      state: typeof company.state === 'string' ? company.state : null,
      logoUrl: typeof company.logo_url === 'string' ? company.logo_url : null,
      locationLabel: persona.locationLabel,
      assistantName: persona.name,
      assistantRole: persona.role,
      occasionalEmoji: persona.occasionalEmoji,
    }
  } catch {
    return {}
  }
}
