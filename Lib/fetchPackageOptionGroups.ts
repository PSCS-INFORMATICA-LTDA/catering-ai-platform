import { getCdlCompanyId } from '@/Lib/cdlCompany'
import type {
  PackageOptionGroup,
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import { mergeOptionGroupsForPackage } from '@/Lib/packageOptionGroups'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

/** CDL pilot: grupos/itens são por company_id + package_id apenas. */
export const PACKAGE_OPTION_BRANCH_FILTER_ENABLED = false

export type PackageOptionQueryErrorInfo = {
  message: string
  details: string | null
  hint: string | null
  code: string | null
}

export type PackageOptionQueryDebug = {
  queryCompanyId: string
  packageIds: string[]
  packageIdsCount: number
  currentBranchId: string | null
  branchFilterActive: boolean
  groupsFetched: number
  itemsFetched: number
  groupsQueryRan: boolean
  itemsQueryRan: boolean
  groupsError: PackageOptionQueryErrorInfo | null
  itemsError: PackageOptionQueryErrorInfo | null
}

type SupabaseErrorLike = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

export function toPackageOptionQueryError(
  error: SupabaseErrorLike | null | undefined,
): PackageOptionQueryErrorInfo | null {
  if (!error?.message?.trim()) return null
  return {
    message: error.message.trim(),
    details: error.details?.trim() || null,
    hint: error.hint?.trim() || null,
    code: error.code?.trim() || null,
  }
}

export function resolvePackageIdsForQuery(options?: {
  packageId?: string | null
  packageIds?: string[] | null
}): string[] {
  if (options?.packageId?.trim()) {
    return [options.packageId.trim()]
  }

  const raw = options?.packageIds
  const asArray = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : []

  return [
    ...new Set(
      asArray.map((id) => id?.trim()).filter(Boolean) as string[],
    ),
  ]
}

function buildQueryDebug(
  options: {
    packageId?: string | null
    packageIds?: string[] | null
    currentBranchId?: string | null
    companyId?: string | null
  },
  partial: Partial<PackageOptionQueryDebug>,
): PackageOptionQueryDebug {
  const packageIds = resolvePackageIdsForQuery(options)
  return {
    queryCompanyId: options.companyId?.trim() || getCdlCompanyId(),
    packageIds,
    packageIdsCount: packageIds.length,
    currentBranchId: options.currentBranchId?.trim() || null,
    branchFilterActive: PACKAGE_OPTION_BRANCH_FILTER_ENABLED,
    groupsFetched: 0,
    itemsFetched: 0,
    groupsQueryRan: false,
    itemsQueryRan: false,
    groupsError: null,
    itemsError: null,
    ...partial,
  }
}

function mapGroupRecord(row: PackageOptionGroupRecord): PackageOptionGroupRecord {
  return {
    ...row,
    option_group_key:
      row.option_group_key?.trim() || row.group_key?.trim() || '',
  }
}

/** Etapa A — grupos sem join aninhado. */
export async function fetchPackageOptionGroupsOnly(options?: {
  packageId?: string | null
  packageIds?: string[] | null
  includeInactive?: boolean
  currentBranchId?: string | null
  companyId?: string | null
}) {
  const queryCompanyId =
    options?.companyId?.trim() || getCdlCompanyId().trim()
  const packageIds = resolvePackageIdsForQuery(options)

  if (packageIds.length === 0) {
    return {
      data: [] as PackageOptionGroupRecord[],
      error: null,
      queryRan: false,
      packageIds,
      queryCompanyId,
    }
  }

  if (!queryCompanyId) {
    const error = {
      message: 'queryCompanyId vazio — não é possível buscar package_option_groups',
      details: null,
      hint: 'Defina NEXT_PUBLIC_CDL_COMPANY_ID no ambiente.',
      code: 'MISSING_COMPANY_ID',
    }
    return {
      data: null as PackageOptionGroupRecord[] | null,
      error,
      queryRan: false,
      packageIds,
      queryCompanyId,
    }
  }

  const supabase = getSupabaseServerClient()

  let query = supabase
    .from('package_option_groups')
    .select(
      'id, company_id, package_id, option_group_key, group_key, label_pt, label_en, label_es, min_choices, max_choices, required, blocks_additional_items, display_order, active',
    )
    .eq('company_id', queryCompanyId)
    .in('package_id', packageIds)
    .order('display_order', { ascending: true })

  if (!options?.includeInactive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) {
    return {
      data: null as PackageOptionGroupRecord[] | null,
      error,
      queryRan: true,
      packageIds,
      queryCompanyId,
    }
  }

  return {
    data: ((data ?? []) as unknown as PackageOptionGroupRecord[]).map(
      mapGroupRecord,
    ),
    error: null,
    queryRan: true,
    packageIds,
    queryCompanyId,
  }
}

/** Etapa B — itens por option_group_id (não chama .in vazio). */
export async function fetchPackageOptionGroupItems(
  optionGroupIds: string[],
  options?: { includeInactive?: boolean; companyId?: string | null },
) {
  const queryCompanyId =
    options?.companyId?.trim() || getCdlCompanyId().trim()
  const ids = [...new Set(optionGroupIds.filter((id) => id?.trim()))]

  if (ids.length === 0) {
    return {
      data: [] as PackageOptionGroupItem[],
      error: null,
      queryRan: false,
      queryCompanyId,
    }
  }

  if (!queryCompanyId) {
    const error = {
      message:
        'queryCompanyId vazio — não é possível buscar package_option_group_items',
      details: null,
      hint: 'Defina NEXT_PUBLIC_CDL_COMPANY_ID no ambiente.',
      code: 'MISSING_COMPANY_ID',
    }
    return {
      data: null as PackageOptionGroupItem[] | null,
      error,
      queryRan: false,
      queryCompanyId,
    }
  }

  const supabase = getSupabaseServerClient()

  let query = supabase
    .from('package_option_group_items')
    .select(
      'id, company_id, option_group_id, additional_item_id, option_item_key, label_pt, label_en, label_es, display_order, active, price_delta',
    )
    .eq('company_id', queryCompanyId)
    .in('option_group_id', ids)
    .order('display_order', { ascending: true })

  if (!options?.includeInactive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) {
    return {
      data: null as PackageOptionGroupItem[] | null,
      error,
      queryRan: true,
      queryCompanyId,
    }
  }

  return {
    data: (data ?? []) as unknown as PackageOptionGroupItem[],
    error: null,
    queryRan: true,
    queryCompanyId,
  }
}

/** Busca em duas etapas — fonte única para cotação. */
export async function loadPackageOptionChoices(options?: {
  packageId?: string | null
  packageIds?: string[] | null
  includeInactive?: boolean
  currentBranchId?: string | null
  companyId?: string | null
}) {
  const packageIds = resolvePackageIdsForQuery(options)

  if (packageIds.length === 0) {
    return {
      groups: [] as PackageOptionGroupRecord[],
      groupItems: [] as PackageOptionGroupItem[],
      error: null,
      queryDebug: buildQueryDebug(options ?? {}, {}),
    }
  }

  const groupsRes = await fetchPackageOptionGroupsOnly(options)

  if (groupsRes.error) {
    return {
      groups: [] as PackageOptionGroupRecord[],
      groupItems: [] as PackageOptionGroupItem[],
      error: groupsRes.error,
      queryDebug: buildQueryDebug(options ?? {}, {
        groupsQueryRan: groupsRes.queryRan,
        groupsFetched: 0,
        itemsFetched: 0,
        groupsError: toPackageOptionQueryError(groupsRes.error),
      }),
    }
  }

  const groups = groupsRes.data ?? []
  const groupIds = groups.map((group) => group.id)

  if (groupIds.length === 0) {
    return {
      groups,
      groupItems: [] as PackageOptionGroupItem[],
      error: null,
      queryDebug: buildQueryDebug(options ?? {}, {
        groupsQueryRan: groupsRes.queryRan,
        groupsFetched: groups.length,
        itemsFetched: 0,
        itemsQueryRan: false,
      }),
    }
  }

  const itemsRes = await fetchPackageOptionGroupItems(groupIds, {
    includeInactive: options?.includeInactive,
    companyId: options?.companyId,
  })

  const groupItems = itemsRes.error ? [] : (itemsRes.data ?? [])

  return {
    groups,
    groupItems,
    error: itemsRes.error ?? null,
    queryDebug: buildQueryDebug(options ?? {}, {
      groupsQueryRan: groupsRes.queryRan,
      itemsQueryRan: itemsRes.queryRan,
      groupsFetched: groups.length,
      itemsFetched: groupItems.length,
      itemsError: toPackageOptionQueryError(itemsRes.error),
    }),
  }
}

/** Compat — grupos com items anexados no código. */
export async function fetchPackageOptionGroups(options?: {
  packageId?: string | null
  packageIds?: string[] | null
  includeInactive?: boolean
  companyId?: string | null
}) {
  const { groups, groupItems, error } = await loadPackageOptionChoices(options)
  if (error) {
    return { data: null as PackageOptionGroup[] | null, error }
  }

  const resolvedIds = resolvePackageIdsForQuery(options)
  const packageIds = resolvedIds.length
    ? resolvedIds
    : [...new Set(groups.map((g) => g.package_id).filter(Boolean))]

  const hydrated = packageIds.flatMap((packageId) =>
    mergeOptionGroupsForPackage(packageId, groups, groupItems, {
      includeEmptyGroups: true,
    }),
  )

  return { data: hydrated, error: null }
}

export async function fetchQuotePackageSelections(quoteId: string) {
  const companyId = getCdlCompanyId()
  const supabase = getSupabaseServerClient()

  let query = supabase
    .from('quote_package_selections')
    .select(
      'id, company_id, quote_id, package_id, option_group_id, option_item_id',
    )
    .eq('quote_id', quoteId)

  if (companyId?.trim()) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}
