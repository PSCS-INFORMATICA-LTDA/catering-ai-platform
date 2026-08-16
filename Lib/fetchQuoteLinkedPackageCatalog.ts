import { buildPackagesListSelect } from '@/Lib/packagesTableSchema'
import {
  getBasePackageKey,
  resolvePackageCatalogImageUrl,
  type PackageCatalogRecord,
} from '@/Lib/packageCatalogVisual'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

type PackageRow = PackageCatalogRecord & {
  id: string
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
}

export type QuoteLinkedPackageCatalog = {
  linkedPackage: PackageRow | null
  catalogPackages: PackageRow[]
  resolvedImageUrl: string | null
}

const EMPTY_CATALOG: QuoteLinkedPackageCatalog = {
  linkedPackage: null,
  catalogPackages: [],
  resolvedImageUrl: null,
}

async function fetchPackageById(
  packageId: string,
  companyId?: string | null,
): Promise<PackageRow | null> {
  const db = getSupabaseServerClient()
  let query = db
    .from('packages')
    .select(buildPackagesListSelect())
    .eq('id', packageId)
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error(
      `[CDL Quote] Failed to load package ${packageId}:`,
      error.message,
    )
    return null
  }

  return (data as PackageRow | null) ?? null
}

async function fetchPackageByKey(
  packageKey: string,
  companyId?: string | null,
): Promise<PackageRow | null> {
  const db = getSupabaseServerClient()
  let query = db
    .from('packages')
    .select(buildPackagesListSelect())
    .eq('package_key', packageKey)
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error(
      `[CDL Quote] Failed to load package key ${packageKey}:`,
      error.message,
    )
    return null
  }

  return (data as PackageRow | null) ?? null
}

async function fetchBasePackageForKey(
  packageKey: string,
  companyId?: string | null,
): Promise<PackageRow | null> {
  const baseKey = getBasePackageKey(packageKey)
  if (!baseKey || baseKey === packageKey) return null
  return fetchPackageByKey(baseKey, companyId)
}

export async function fetchQuoteLinkedPackageCatalog(input: {
  packageId?: string | null
  packageKey?: string | null
  companyId?: string | null
}): Promise<QuoteLinkedPackageCatalog> {
  const packageId = input.packageId?.trim()
  const packageKey = input.packageKey?.trim()
  const companyId = input.companyId?.trim() || null

  let linkedPackage: PackageRow | null = null

  if (packageId) {
    linkedPackage = await fetchPackageById(packageId, companyId)
  }

  if (!linkedPackage && packageKey) {
    linkedPackage = await fetchPackageByKey(packageKey, companyId)
  }

  if (!linkedPackage) {
    return EMPTY_CATALOG
  }

  const catalogPackages: PackageRow[] = [linkedPackage]
  const linkedKey = (linkedPackage.package_key ?? packageKey ?? '').trim()

  if (linkedKey.endsWith('+')) {
    const basePackage = await fetchBasePackageForKey(linkedKey, companyId)
    if (basePackage && !catalogPackages.some((pkg) => pkg.id === basePackage.id)) {
      catalogPackages.push(basePackage)
    }
  }

  const resolvedImageUrl = resolvePackageCatalogImageUrl(
    linkedPackage,
    catalogPackages,
    linkedPackage.id,
  )

  return {
    linkedPackage,
    catalogPackages,
    resolvedImageUrl,
  }
}
