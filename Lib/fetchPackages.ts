import { getCdlCompanyId } from './cdlCompany'
import { buildPackagesListSelect } from './packagesTableSchema'
import { getSupabaseServerClient } from './supabaseServer'

export type PackageListItem = {
  id: string
  company_id?: string | null
  package_key?: string | null
  package_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  description?: string | null
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
  price_per_person?: number | null
  currency_code?: string | null
  display_order?: number | null
  image_url?: string | null
  image_status?: string | null
  image_notes?: string | null
  package_highlights_pt?: string | null
  package_highlights_en?: string | null
  package_highlights_es?: string | null
  card_theme_key?: string | null
  active?: boolean | null
  updated_at?: string | null
}

type FetchPackagesOptions = {
  activeOnly?: boolean
  includeInactive?: boolean
  companyId?: string | null
  includeGlobal?: boolean
}

export async function fetchPackages(options: FetchPackagesOptions = {}) {
  const companyId = options.companyId?.trim() || getCdlCompanyId()

  const supabase = getSupabaseServerClient()
  let query = supabase
    .from('packages')
    .select(buildPackagesListSelect())
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('label_pt', { ascending: true })

  if (companyId?.trim()) {
    query =
      options.includeGlobal === false
        ? query.eq('company_id', companyId)
        : query.or(`company_id.eq.${companyId},company_id.is.null`)
  }

  if (options.activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) {
    return { data: null as PackageListItem[] | null, error }
  }

  let rows = (data ?? []) as unknown as PackageListItem[]

  if (!options.includeInactive && !options.activeOnly) {
    rows = rows.filter((row) => row.active !== false)
  }

  return { data: rows, error: null }
}
