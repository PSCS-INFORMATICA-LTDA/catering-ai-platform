import type { PackagesInsertPayload } from '@/Lib/packagesTableSchema'
import { pickPackagesInsertPayload } from '@/Lib/packagesTableSchema'
import { pickLocalizedText } from '@/Lib/i18n/locales'

export type PackageFieldSource = {
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
  active?: boolean | null
}

export function getPackageKey(pkg: PackageFieldSource | null | undefined): string {
  return (pkg?.package_key ?? '').trim()
}

export function getPackageLabel(
  pkg: PackageFieldSource | null | undefined,
  locale?: string | null,
): string {
  return (
    pickLocalizedText(
      {
        pt: pkg?.label_pt,
        en: pkg?.label_en,
        es: pkg?.label_es,
      },
      locale,
    ).trim() ||
    pkg?.package_name?.trim() ||
    getPackageKey(pkg) ||
    'Pacote'
  )
}

export function getPackageDescription(
  pkg: PackageFieldSource | null | undefined,
  locale?: string | null,
): string {
  return (
    pickLocalizedText(
      {
        pt: pkg?.description_pt,
        en: pkg?.description_en,
        es: pkg?.description_es,
      },
      locale,
    ).trim() ||
    pkg?.description?.trim() ||
    ''
  )
}

export function getPackagePrice(pkg: PackageFieldSource | null | undefined): number {
  return Number(pkg?.price_per_person ?? 0)
}

export function getPackageImageUrl(
  pkg: PackageFieldSource | null | undefined,
): string | null {
  const url = pkg?.image_url?.trim()
  return url || null
}

export function getPackageCurrencyCode(
  pkg: PackageFieldSource | null | undefined,
): string {
  return pkg?.currency_code?.trim() || 'USD'
}

export function getPackageDisplayOrder(
  pkg: PackageFieldSource | null | undefined,
): number {
  return Number(pkg?.display_order ?? 999)
}

export function getPackageHasGarnish(pkg: PackageFieldSource | null | undefined): boolean {
  return getPackageKey(pkg).endsWith('+')
}

export function mapPackageDraftToDeployed(
  draft: PackagesInsertPayload,
): PackagesInsertPayload {
  return pickPackagesInsertPayload(draft)
}
