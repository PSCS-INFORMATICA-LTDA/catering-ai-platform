import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { DEFAULT_COMPANY_TIMEZONE, normalizeCompanyTimezone } from './eventInstant'

export async function loadCompanyTimezone(companyId: string): Promise<string> {
  if (!companyId) return DEFAULT_COMPANY_TIMEZONE
  const { data } = await getSupabaseServerClient()
    .from('companies')
    .select('timezone, google_calendar_timezone')
    .eq('id', companyId)
    .maybeSingle()
  return normalizeCompanyTimezone(
    data?.timezone || data?.google_calendar_timezone || DEFAULT_COMPANY_TIMEZONE,
  )
}
