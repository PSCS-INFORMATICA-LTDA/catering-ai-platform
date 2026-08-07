import type { QuoteLanguage } from './quoteWizardTypes'

export type PackageCatalogVariant = 'without_sides' | 'with_sides' | 'custom'

export type PackageCatalogFields = {
  package_key?: string | null
  package_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
  price_per_person?: number | null
  price?: number | null
  base_price?: number | null
  image_url?: string | null
}

export type PackageSidesPricingMode = 'breakdown' | 'total_included'

export type PackageSidesPricingDisplay = {
  mode: PackageSidesPricingMode
  sidesPricePerPerson: number
  basePricePerPerson: number | null
  totalPerPerson: number
}

const PRICE_TOLERANCE = 0.01

export function getPackageCatalogVariant(
  pkg: PackageCatalogFields,
): PackageCatalogVariant {
  const key = (pkg.package_key ?? '').trim().toUpperCase()
  if (key.includes('PERS')) return 'custom'
  if (key.endsWith('+')) return 'with_sides'
  return 'without_sides'
}

export function getPackageCatalogName(
  pkg: PackageCatalogFields,
  language: QuoteLanguage = 'pt',
): string {
  if (language === 'en') {
    return (
      pkg.label_en ??
      pkg.package_name ??
      pkg.label_pt ??
      '—'
    )
  }
  if (language === 'es') {
    return (
      pkg.label_es ??
      pkg.package_name ??
      pkg.label_pt ??
      '—'
    )
  }
  return (
    pkg.label_pt ??
    pkg.package_name ??
    pkg.label_en ??
    '—'
  )
}

export function getPackageCatalogImage(
  pkg: PackageCatalogFields,
  allPackages?: ReadonlyArray<PackageCatalogFields>,
): string | null {
  const direct = pkg.image_url?.trim() || null
  if (direct) return direct

  if (!allPackages?.length) return null

  const basePackage = findBasePackage(pkg, allPackages)
  if (basePackage) {
    return basePackage.image_url?.trim() || null
  }

  return null
}

export type PackageCatalogRecord = PackageCatalogFields & { id?: string }

/** Mesma resolução de imagem usada na seleção e na revisão do pacote. */
export function resolvePackageCatalogImageUrl(
  pkg: PackageCatalogRecord | null | undefined,
  allPackages: ReadonlyArray<PackageCatalogRecord> = [],
  packageId?: string | null,
): string | null {
  if (pkg) {
    const fromSelected = getPackageCatalogImage(pkg, allPackages)
    if (fromSelected) return fromSelected
  }

  const normalizedId = packageId?.trim()
  if (normalizedId && allPackages.length > 0) {
    const match = allPackages.find((candidate) => candidate.id === normalizedId)
    if (match) {
      return getPackageCatalogImage(match, allPackages)
    }
  }

  return null
}

export function getPackageCatalogPrice(pkg: PackageCatalogFields): number {
  return Number(pkg.price_per_person ?? pkg.price ?? pkg.base_price ?? 0)
}

export function getBasePackageKey(packageKey: string): string {
  return packageKey.trim().replace(/\+$/, '')
}

export function findBasePackage(
  pkg: PackageCatalogFields,
  allPackages: ReadonlyArray<PackageCatalogFields>,
): PackageCatalogFields | null {
  const key = (pkg.package_key ?? '').trim()
  if (!key.endsWith('+')) return null
  const baseKey = getBasePackageKey(key)
  return (
    allPackages.find(
      (candidate) => (candidate.package_key ?? '').trim() === baseKey,
    ) ?? null
  )
}

/**
 * Exibição visual do preço com guarnições — não altera o valor salvo na cotação
 * (sempre usa `price_per_person` do pacote selecionado no Supabase).
 */
export function resolvePackageSidesPricing(
  pkg: PackageCatalogFields,
  basePackage: PackageCatalogFields | null,
  sidesPricePerPerson: number,
): PackageSidesPricingDisplay | null {
  if (getPackageCatalogVariant(pkg) !== 'with_sides') return null

  const registered = getPackageCatalogPrice(pkg)
  const basePrice = basePackage ? getPackageCatalogPrice(basePackage) : null

  if (
    basePrice != null &&
    Math.abs(registered - (basePrice + sidesPricePerPerson)) < PRICE_TOLERANCE
  ) {
    return {
      mode: 'breakdown',
      sidesPricePerPerson,
      basePricePerPerson: basePrice,
      totalPerPerson: registered,
    }
  }

  if (
    basePrice != null &&
    registered > basePrice + PRICE_TOLERANCE
  ) {
    return {
      mode: 'breakdown',
      sidesPricePerPerson: registered - basePrice,
      basePricePerPerson: basePrice,
      totalPerPerson: registered,
    }
  }

  if (
    basePrice != null &&
    Math.abs(registered - basePrice) < PRICE_TOLERANCE
  ) {
    return {
      mode: 'total_included',
      sidesPricePerPerson,
      basePricePerPerson: basePrice,
      totalPerPerson: registered,
    }
  }

  return {
    mode: 'total_included',
    sidesPricePerPerson,
    basePricePerPerson: basePrice,
    totalPerPerson: registered,
  }
}

export function isPackageCatalogPriceOnRequest(
  pkg: PackageCatalogFields,
): boolean {
  if (getPackageCatalogVariant(pkg) !== 'custom') return false
  const price = getPackageCatalogPrice(pkg)
  return !Number.isFinite(price) || price <= 0
}

function perPersonSuffix(language: QuoteLanguage): string {
  if (language === 'en') return 'person'
  if (language === 'es') return 'persona'
  return 'pessoa'
}

export function getPackageCatalogPriceOnRequestLabel(
  language: QuoteLanguage,
): string {
  if (language === 'en') return 'Price on request'
  if (language === 'es') return 'Bajo consulta'
  return 'Sob consulta'
}

export function formatPackageCatalogPriceLabel(
  pkg: PackageCatalogFields,
  language: QuoteLanguage,
  formatCurrency: (value: number) => string,
): string {
  if (isPackageCatalogPriceOnRequest(pkg)) {
    return getPackageCatalogPriceOnRequestLabel(language)
  }

  return `${formatCurrency(getPackageCatalogPrice(pkg))} / ${perPersonSuffix(language)}`
}

export function getPackageSidesDescription(language: QuoteLanguage): string {
  if (language === 'en') {
    return 'Sides: white rice, black beans, vinaigrette, farofa and cassava.'
  }
  if (language === 'es') {
    return 'Guarniciones: arroz blanco, feijão preto, vinagrete, farofa y mandioca.'
  }
  return 'Guarnições: arroz branco, feijão preto, vinagrete, farofa e mandioca.'
}

export function getPackageSidesIncludedLabel(language: QuoteLanguage): string {
  if (language === 'en') return 'Sides included'
  if (language === 'es') return 'Guarniciones incluidas'
  return 'Guarnições incluídas'
}

export function getPackagePriceLineLabel(
  kind: 'package' | 'sides' | 'total',
  language: QuoteLanguage,
): string {
  if (language === 'en') {
    if (kind === 'package') return 'Package'
    if (kind === 'sides') return 'Sides'
    return 'Total'
  }
  if (language === 'es') {
    if (kind === 'package') return 'Paquete'
    if (kind === 'sides') return 'Guarniciones'
    return 'Total'
  }
  if (kind === 'package') return 'Pacote'
  if (kind === 'sides') return 'Guarnições'
  return 'Total'
}
