import {
  CDL_PACKAGES,
  PACKAGE_COMMON_ITEMS,
  SIDES_ITEMS,
} from '@/Lib/cdlCommercialRules'
import {
  findBasePackage,
  getBasePackageKey,
  getPackageCatalogName,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  getPackageSidesDescription,
  resolvePackageSidesPricing,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import { translateCdlItemList } from '@/Lib/cdlPackageItemI18n'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'

export type QuoteReviewPackageFields = PackageCatalogFields & {
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
  description?: string | null
}

export type QuoteReviewPackageSummaryInput = {
  pkg: QuoteReviewPackageFields | null
  allPackages?: ReadonlyArray<PackageCatalogFields>
  sidesPricePerPerson: number
  chargedPeople: number
  fromWithSidesSection?: boolean
  language?: QuoteLanguage
}

export type QuoteReviewPackageSummary = {
  hasGarnish: boolean
  packageItemsDescription: string | null
  garnishDescription: string
  packageUnitPrice: number
  garnishUnitPrice: number
  totalUnitPrice: number
  chargedPeople: number
  packageTotalPrice: number
  garnishTotalPrice: number
  grandTotalPrice: number
}

const DESCRIPTION_SECTION_MARKERS = [
  'Todos os pacotes acompanham:',
  'All packages include:',
  'Todos los paquetes incluyen:',
  'Guarnições inclusas',
  'Included sides',
  'Guarniciones incluidas',
  'Guarnições:',
  'Sides:',
  'Guarniciones:',
  'Itens do pacote:',
  'Package items:',
  'Ítems del paquete:',
] as const

const PACKAGE_ITEMS_HEADERS = [
  'Itens do pacote:',
  'Package items:',
  'Ítems del paquete:',
] as const

const COMMON_ITEMS_HEADERS = [
  'Todos os pacotes acompanham:',
  'All packages include:',
  'Todos los paquetes incluyen:',
] as const

const GARNISH_HEADERS = [
  'Guarnições:',
  'Sides:',
  'Guarniciones:',
] as const

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getDescriptionText(
  pkg: QuoteReviewPackageFields,
  language: QuoteLanguage = 'pt',
): string {
  if (language === 'en') {
    return (
      pkg.description_en?.trim() ||
      pkg.description_pt?.trim() ||
      pkg.description?.trim() ||
      ''
    )
  }
  if (language === 'es') {
    return (
      pkg.description_es?.trim() ||
      pkg.description_pt?.trim() ||
      pkg.description?.trim() ||
      ''
    )
  }
  return (
    pkg.description_pt?.trim() ||
    pkg.description_en?.trim() ||
    pkg.description_es?.trim() ||
    pkg.description?.trim() ||
    ''
  )
}

function parseBulletItems(section: string): string[] {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(Boolean)
}

function firstMatchingSection(
  description: string,
  headers: readonly string[],
): string | null {
  for (const header of headers) {
    const section = extractDescriptionSection(description, header)
    if (section) return section
  }
  return null
}

function extractDescriptionSection(
  description: string,
  header: string,
): string | null {
  const idx = description.indexOf(header)
  if (idx === -1) return null

  const rest = description.slice(idx + header.length)
  let end = rest.length

  for (const marker of DESCRIPTION_SECTION_MARKERS) {
    const markerIndex = rest.indexOf(marker)
    if (markerIndex !== -1 && markerIndex < end) {
      end = markerIndex
    }
  }

  const section = rest.slice(0, end).trim()
  return section || null
}

function formatItemsList(items: readonly string[]): string {
  return items.join(', ')
}

function getCdlPackageDefinition(packageKey: string | null | undefined) {
  const normalizedKey = (packageKey ?? '').trim().replace(/\+$/, '')
  if (!normalizedKey) return null
  return CDL_PACKAGES.find((pkg) => pkg.package_key === normalizedKey) ?? null
}

function getCdlBasePackageDefinition(packageKey: string | null | undefined) {
  const baseKey = getBasePackageKey((packageKey ?? '').trim())
  if (!baseKey) return null
  return CDL_PACKAGES.find((pkg) => pkg.package_key === baseKey) ?? null
}

function getCdlBaseUnitPrice(packageKey: string | null | undefined): number | null {
  const definition = getCdlBasePackageDefinition(packageKey)
  return definition?.price_per_person ?? null
}

function packageNameIndicatesGarnish(
  pkg: QuoteReviewPackageFields,
  language: QuoteLanguage = 'pt',
): boolean {
  const name = getPackageCatalogName(pkg, language).toLowerCase()
  return (
    name.includes('guarni') ||
    name.includes('guarnicion') ||
    name.includes('side dish')
  )
}

function packageLikelyHasGarnish(
  pkg: QuoteReviewPackageFields,
  language: QuoteLanguage = 'pt',
): boolean {
  const packageKey = (pkg.package_key ?? '').trim()
  return (
    packageKey.endsWith('+') ||
    packageNameIndicatesGarnish(pkg, language) ||
    getPackageCatalogVariant(pkg) === 'with_sides'
  )
}

export function packageItemsDescription(
  pkg: QuoteReviewPackageFields | null,
  language: QuoteLanguage = 'pt',
): string | null {
  if (!pkg) return null

  const description = getDescriptionText(pkg, language)
  if (description) {
    const packageSection = firstMatchingSection(description, PACKAGE_ITEMS_HEADERS)
    const commonSection = firstMatchingSection(description, COMMON_ITEMS_HEADERS)
    const packageItems = packageSection ? parseBulletItems(packageSection) : []
    const commonItems = commonSection ? parseBulletItems(commonSection) : []
    const combined = [...packageItems, ...commonItems]
    if (combined.length > 0) {
      return formatItemsList(translateCdlItemList(combined, language))
    }
  }

  const definition = getCdlPackageDefinition(pkg.package_key)
  if (definition) {
    return formatItemsList(
      translateCdlItemList(
        [...definition.items, ...PACKAGE_COMMON_ITEMS],
        language,
      ),
    )
  }

  return null
}

function garnishItemsFromDescription(
  pkg: QuoteReviewPackageFields,
  language: QuoteLanguage,
): string[] {
  const description = getDescriptionText(pkg, language)
  if (!description) return []

  const garnishHeaderMatch = description.match(
    /(?:Guarnições inclusas|Included sides|Guarniciones incluidas)(?:\s*\([^)]+\))?:/i,
  )
  const garnishSection = garnishHeaderMatch
    ? extractDescriptionSection(description, garnishHeaderMatch[0]) ??
      description.slice(description.indexOf(garnishHeaderMatch[0]) + garnishHeaderMatch[0].length)
    : firstMatchingSection(description, GARNISH_HEADERS)

  return garnishSection ? parseBulletItems(garnishSection) : []
}

export function garnishDescription(
  pkg: QuoteReviewPackageFields | null,
  language: QuoteLanguage = 'pt',
): string | null {
  if (!pkg) return null

  const packageKey = (pkg.package_key ?? '').trim()
  if (packageKey.endsWith('+')) {
    const fromDescription = garnishItemsFromDescription(pkg, language)
    if (fromDescription.length > 0) {
      return formatItemsList(translateCdlItemList(fromDescription, language))
    }
    return formatItemsList(translateCdlItemList([...SIDES_ITEMS], language))
  }

  const fromDescription = garnishItemsFromDescription(pkg, language)
  if (fromDescription.length > 0) {
    return formatItemsList(translateCdlItemList(fromDescription, language))
  }

  const definition = getCdlPackageDefinition(pkg.package_key)
  if (definition?.with_sides) {
    return formatItemsList(translateCdlItemList([...SIDES_ITEMS], language))
  }

  const variant = getPackageCatalogVariant(pkg)
  if (variant === 'with_sides') {
    const sidesText = getPackageSidesDescription(language)
    const prefix = language === 'en' ? 'Sides: ' : language === 'es' ? 'Guarniciones: ' : 'Guarnições: '
    if (sidesText.startsWith(prefix)) {
      return sidesText.slice(prefix.length).trim()
    }
    return sidesText
  }

  return null
}

export function totalUnitPrice(pkg: QuoteReviewPackageFields | null): number {
  if (!pkg) return 0
  return getPackageCatalogPrice(pkg)
}

/** Preço base do pacote sem guarnições. */
export function packageUnitPrice(
  pkg: QuoteReviewPackageFields | null,
  allPackages: ReadonlyArray<PackageCatalogFields> = [],
  sidesPricePerPerson = 0,
): number {
  if (!pkg) return 0

  const registered = getPackageCatalogPrice(pkg)
  const packageKey = (pkg.package_key ?? '').trim()
  const likelyHasGarnish = packageLikelyHasGarnish(pkg)
  const basePackage = findBasePackage(pkg, allPackages)
  const catalogBasePrice = getCdlBaseUnitPrice(packageKey)
  const sidesPricing = likelyHasGarnish
    ? resolvePackageSidesPricing(
        pkg,
        basePackage ??
          (catalogBasePrice != null
            ? { package_key: getBasePackageKey(packageKey), price_per_person: catalogBasePrice }
            : null),
        sidesPricePerPerson,
      )
    : null

  if (sidesPricing?.mode === 'breakdown' && sidesPricing.basePricePerPerson != null) {
    return sidesPricing.basePricePerPerson
  }

  if (basePackage) {
    return getPackageCatalogPrice(basePackage)
  }

  if (catalogBasePrice != null) {
    return catalogBasePrice
  }

  if (likelyHasGarnish && sidesPricePerPerson > 0) {
    const derivedBase = registered - sidesPricePerPerson
    if (derivedBase > 0 && derivedBase < registered) {
      return roundMoney(derivedBase)
    }
  }

  if (sidesPricing?.basePricePerPerson != null) {
    return sidesPricing.basePricePerPerson
  }

  return registered
}

/** Alias semântico para o preço base sem guarnições. */
export const packageBaseUnitPrice = packageUnitPrice

export function garnishUnitPrice(
  pkg: QuoteReviewPackageFields | null,
  allPackages: ReadonlyArray<PackageCatalogFields> = [],
  sidesPricePerPerson = 0,
): number {
  if (!pkg) return 0

  const registered = getPackageCatalogPrice(pkg)
  const base = packageUnitPrice(pkg, allPackages, sidesPricePerPerson)
  const packageKey = (pkg.package_key ?? '').trim()
  const likelyHasGarnish = packageLikelyHasGarnish(pkg)

  if (!likelyHasGarnish) {
    return 0
  }

  const basePackage = findBasePackage(pkg, allPackages)
  const catalogBasePrice = getCdlBaseUnitPrice(packageKey)
  const sidesPricing = resolvePackageSidesPricing(
    pkg,
    basePackage ??
      (catalogBasePrice != null
        ? { package_key: getBasePackageKey(packageKey), price_per_person: catalogBasePrice }
        : null),
    sidesPricePerPerson,
  )

  if (sidesPricing?.mode === 'breakdown') {
    return sidesPricing.sidesPricePerPerson
  }

  const diff = roundMoney(registered - base)
  if (diff > 0) {
    return diff
  }

  if (sidesPricePerPerson > 0) {
    return sidesPricePerPerson
  }

  return 0
}

export function chargedPeople(count: number | null | undefined): number {
  return Math.max(0, Number(count ?? 0))
}

export function packageTotalPrice(
  unitPrice: number,
  people: number,
): number {
  return roundMoney(unitPrice * chargedPeople(people))
}

export function garnishTotalPrice(
  unitPrice: number,
  people: number,
): number {
  return roundMoney(unitPrice * chargedPeople(people))
}

export function grandTotalPrice(
  unitPrice: number,
  people: number,
): number {
  return roundMoney(unitPrice * chargedPeople(people))
}

export function hasGarnish(input: {
  pkg: QuoteReviewPackageFields | null
  fromWithSidesSection?: boolean
  garnishUnitPrice: number
  garnishDescription: string | null
  language?: QuoteLanguage
}): boolean {
  if (!input.pkg) return false

  const packageKey = (input.pkg.package_key ?? '').trim()
  const language = input.language ?? 'pt'

  return (
    Boolean(input.fromWithSidesSection) ||
    packageKey.endsWith('+') ||
    packageNameIndicatesGarnish(input.pkg, language) ||
    input.garnishUnitPrice > 0 ||
    Boolean(input.garnishDescription?.trim())
  )
}

export function buildQuoteReviewPackageSummary(
  input: QuoteReviewPackageSummaryInput,
): QuoteReviewPackageSummary | null {
  if (!input.pkg) return null

  const language = input.language ?? 'pt'
  const people = chargedPeople(input.chargedPeople)
  const garnishItems = garnishDescription(input.pkg, language)
  const garnishPerPerson = garnishUnitPrice(
    input.pkg,
    input.allPackages ?? [],
    input.sidesPricePerPerson,
  )
  const garnish = hasGarnish({
    pkg: input.pkg,
    fromWithSidesSection: input.fromWithSidesSection,
    garnishUnitPrice: garnishPerPerson,
    garnishDescription: garnishItems,
    language,
  })
  const basePerPerson = packageUnitPrice(
    input.pkg,
    input.allPackages ?? [],
    input.sidesPricePerPerson,
  )
  const totalPerPerson = totalUnitPrice(input.pkg)

  return {
    hasGarnish: garnish,
    packageItemsDescription: packageItemsDescription(input.pkg, language),
    garnishDescription: garnish ? (garnishItems ?? '—') : tw(language, 'no'),
    packageUnitPrice: basePerPerson,
    garnishUnitPrice: garnish ? garnishPerPerson : 0,
    totalUnitPrice: totalPerPerson,
    chargedPeople: people,
    packageTotalPrice: packageTotalPrice(basePerPerson, people),
    garnishTotalPrice: garnishTotalPrice(garnish ? garnishPerPerson : 0, people),
    grandTotalPrice: grandTotalPrice(totalPerPerson, people),
  }
}
