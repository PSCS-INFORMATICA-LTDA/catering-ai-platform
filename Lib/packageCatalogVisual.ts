import type { QuoteLanguage } from './quoteWizardTypes'
import {
  PACKAGE_FOLDER_ART_V2,
  PACKAGE_FOLDER_BUCKET,
  PACKAGE_FOLDER_PREFIX,
} from './publicQuote/packageFolderArt.generated.ts'

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
  currency_code?: string | null
  card_theme_key?: string | null
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

/** Structured Com/Sem guarnição group from the package_key suffix, not the label. */
export function getPublicPackageSidesGroup(
  pkg: PackageCatalogFields,
): 'with_sides' | 'without_sides' {
  return (pkg.package_key ?? '').trim().endsWith('+')
    ? 'with_sides'
    : 'without_sides'
}

const FAMILY_EXAMPLE_ORDER = ['PRI', 'CHO', 'SEL', 'TRAD'] as const

const FAMILY_EXAMPLE_NAMES: Record<
  (typeof FAMILY_EXAMPLE_ORDER)[number],
  Record<QuoteLanguage, string>
> = {
  PRI: { pt: 'Prime', en: 'Prime', es: 'Prime' },
  CHO: { pt: 'Choice', en: 'Choice', es: 'Choice' },
  SEL: { pt: 'Select', en: 'Select', es: 'Select' },
  TRAD: { pt: 'Tradicional', en: 'Traditional', es: 'Tradicional' },
}

/** Commercial short names actually present in an active family — never invented. */
export function getPublicPackageFamilyExampleNames(
  packages: ReadonlyArray<Pick<PackageCatalogFields, 'package_key'>>,
  language: QuoteLanguage = 'pt',
): string[] {
  const present = new Set<string>()
  for (const pkg of packages) {
    const key = (pkg.package_key ?? '').trim().toUpperCase().replace(/\+$/, '')
    for (const code of FAMILY_EXAMPLE_ORDER) {
      if (key.endsWith(code)) present.add(code)
    }
  }
  return FAMILY_EXAMPLE_ORDER.filter((code) => present.has(code)).map(
    (code) => FAMILY_EXAMPLE_NAMES[code][language],
  )
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

/**
 * V2 folder for this package in this locale, if one has been published.
 *
 * The folders carry text, so each package, variant and locale has its own file.
 * They live in the same package-images bucket as everything else — this only
 * picks the right key. Falls back to packages.image_url when a locale has no
 * folder yet, so the catalog can never end up with a blank card.
 */
export function getPackageFolderArt(
  pkg: PackageCatalogFields,
  language?: string | null,
): string | null {
  const key = pkg.package_key?.trim().toUpperCase()
  if (!key) return null
  const locale = language === 'en' || language === 'es' ? language : 'pt'
  const byLocale = PACKAGE_FOLDER_ART_V2[key]
  const file = byLocale?.[locale] ?? byLocale?.pt
  if (!file) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return null
  const url = `${base}/storage/v1/object/public/${PACKAGE_FOLDER_BUCKET}/${PACKAGE_FOLDER_PREFIX}/${file}`
  // Personalized folders were repaired in place; bust the year-long cache
  // on those six objects only. Other V3 art keeps the stored filename.
  if (file.startsWith('bbqpers-')) {
    return `${url}?v=bbfix1`
  }
  return url
}

export function getPackageCatalogImage(
  pkg: PackageCatalogFields,
  allPackages?: ReadonlyArray<PackageCatalogFields>,
  language?: string | null,
): string | null {
  const folder = getPackageFolderArt(pkg, language)
  if (folder) return folder

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

export function getPackagePerPersonUnitLabel(language: QuoteLanguage): string {
  if (language === 'en') return 'person'
  if (language === 'es') return 'persona'
  return 'pessoa'
}

function perPersonSuffix(language: QuoteLanguage): string {
  return getPackagePerPersonUnitLabel(language)
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
    return 'Guarniciones: arroz blanco, frijoles negros, vinagreta, farofa y yuca.'
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

export function getPackagePriceCaption(language: QuoteLanguage): string {
  if (language === 'en') return 'DOLLARS PER PERSON'
  if (language === 'es') return 'DÓLARES POR PERSONA'
  return 'DÓLARES POR PESSOA'
}

export function getPackageHeroAccompanimentHeading(
  language: QuoteLanguage,
): string {
  if (language === 'en') return 'Accompaniments'
  if (language === 'es') return 'Acompañamientos'
  return 'Acompanhamentos'
}

/**
 * Flyer item lists keyed by the unsuffixed commercial package key.
 * Keep in sync with `CDL_PACKAGES` in `Lib/cdlCommercialRules.ts`.
 * Local copy avoids Node ESM pulling that module (and `@/` aliases) into
 * `test:dev:public-quote-v2-nav`.
 */
const PACKAGE_HERO_ITEMS_PT: Record<string, readonly string[]> = {
  BBQTRAD: [
    'Picanha Angus',
    'Linguiça tradicional',
    'Frango sobrecoxa desossada',
    'Pão de alho',
    'Queijo coalho',
    'Milho',
  ],
  BBQSEL: [
    'Picanha Angus',
    'Costela de porco ou boi',
    'Linguiça tradicional',
    'Frango sobrecoxa desossada',
    'Pão de alho',
    'Queijo',
    'Milho',
  ],
  BBQCHO: [
    'Picanha Angus',
    'Salmão ou camarão',
    'Costela de porco ou boi',
    'Linguiça',
    'Frango sobrecoxa desossada',
    'Pão de alho',
    'Queijo',
    'Milho',
  ],
  BBQPRI: [
    'Picanha Angus',
    'Salmão ou camarão',
    'Costela de porco ou boi',
    'Carré de cordeiro',
    'Linguiça',
    'Frango sobrecoxa desossada',
    'Pão de alho',
    'Queijo',
    'Milho',
  ],
}

const PACKAGE_HERO_COMMON_PT = [
  'Chimichurri',
  'Farofa',
  'Mel',
  'Goiabada',
  'Pimenta de bico',
  'Geleia de pimenta',
] as const

const PACKAGE_HERO_ITEM_I18N: Record<string, { en: string; es: string }> = {
  'Picanha Angus': { en: 'Angus picanha', es: 'Picaña Angus' },
  'Linguiça tradicional': {
    en: 'Traditional sausage',
    es: 'Salchicha tradicional',
  },
  Linguiça: { en: 'Sausage', es: 'Salchicha' },
  'Frango sobrecoxa desossada': {
    en: 'Boneless chicken thigh',
    es: 'Muslo de pollo deshuesado',
  },
  'Pão de alho': { en: 'Garlic bread', es: 'Pan de ajo' },
  'Queijo coalho': {
    en: 'Grilled coalho cheese',
    es: 'Queso coalho a la parrilla',
  },
  Queijo: { en: 'Cheese', es: 'Queso' },
  Milho: { en: 'Corn', es: 'Maíz' },
  'Costela de porco ou boi': {
    en: 'Pork or beef ribs',
    es: 'Costilla de cerdo o res',
  },
  'Salmão ou camarão': { en: 'Salmon or shrimp', es: 'Salmón o camarón' },
  'Carré de cordeiro': { en: 'Rack of lamb', es: 'Costillar de cordero' },
  Chimichurri: { en: 'Chimichurri', es: 'Chimichurri' },
  Farofa: { en: 'Farofa', es: 'Farofa' },
  Mel: { en: 'Honey', es: 'Miel' },
  Goiabada: { en: 'Guava paste', es: 'Dulce de guayaba' },
  'Pimenta de bico': { en: "Bird's eye pepper", es: 'Ají de bico' },
  'Geleia de pimenta': { en: 'Pepper jelly', es: 'Jalea de pimiento' },
}

function translateHeroItem(
  label: string,
  language: QuoteLanguage,
): string {
  if (language === 'pt') return label
  const translation = PACKAGE_HERO_ITEM_I18N[label]
  if (!translation) return label
  return language === 'es' ? translation.es : translation.en
}

/**
 * Localized flyer menu. PT keeps the baked art. EN/ES overlay the same
 * commercial items so the JPG is not the language source.
 */
export function getPackageHeroMenuLines(
  pkg: PackageCatalogFields,
  language: QuoteLanguage,
): string[] {
  if (language === 'pt') return []
  if (getPackageCatalogVariant(pkg) === 'custom') return []
  const key = getBasePackageKey(pkg.package_key ?? '').toUpperCase()
  const items = PACKAGE_HERO_ITEMS_PT[key]
  if (!items?.length) return []
  return items.map((item) => translateHeroItem(item, language))
}

export function getPackageHeroAccompanimentLines(
  language: QuoteLanguage,
): string[] {
  if (language === 'pt') return []
  return PACKAGE_HERO_COMMON_PT.map((item) => translateHeroItem(item, language))
}

export function formatPackageHeroPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  const rounded = Math.round(value * 100) / 100
  if (Number.isInteger(rounded)) return `$${rounded}`
  return `$${rounded.toFixed(2)}`
}

export function packageSidesMathHolds(
  pkg: PackageCatalogFields,
  basePackage: PackageCatalogFields | null,
  sidesPricePerPerson: number,
): boolean {
  const pricing = resolvePackageSidesPricing(
    pkg,
    basePackage,
    sidesPricePerPerson,
  )
  if (!pricing) return true
  if (pricing.basePricePerPerson == null) return false
  if (pricing.sidesPricePerPerson <= 0) {
    return (
      Math.abs(pricing.basePricePerPerson - pricing.totalPerPerson) <
      PRICE_TOLERANCE
    )
  }
  return (
    Math.abs(
      pricing.basePricePerPerson +
        pricing.sidesPricePerPerson -
        pricing.totalPerPerson,
    ) < PRICE_TOLERANCE
  )
}
