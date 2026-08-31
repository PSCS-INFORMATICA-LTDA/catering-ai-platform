import {
  garnishDescription,
  packageItemsDescription,
} from '@/components/quote-review/quoteReviewPackageSummary'
import {
  translateCdlItem,
  translateCdlItemList,
  translateCdlJoinedList,
} from '@/Lib/cdlPackageItemI18n'
import { pickLocalizedText } from '@/Lib/i18n/locales'
import type { PackageFieldSource } from '@/Lib/packageFieldAccess'
import {
  getPackageHasGarnish,
  getPackageKey,
} from '@/Lib/packageFieldAccess'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

const DEFAULT_GARNISH_TEXT_PT =
  'Arroz branco • Feijão preto • Vinagrete • Farofa • Maionese'

const TRADITIONAL_BASE_ITEMS = [
  'Picanha Angus',
  'Linguiça tradicional',
  'Frango sobrecoxa desossada',
  'Pão de alho',
  'Queijo coalho',
  'Milho',
] as const

const TRADITIONAL_COMMON_ITEMS = [
  'Chimichurri',
  'Farofa',
  'Mel',
  'Goiabada',
  'Pimenta de bico',
  'Geleia de pimenta',
] as const

const PACKAGE_TIER_ORDER = ['TRAD', 'SEL', 'CHO', 'LUX', 'PRI', 'PERS'] as const

type PackageCommercialTier = (typeof PACKAGE_TIER_ORDER)[number]

const TIER_EXTRA_ITEMS: Record<PackageCommercialTier, readonly string[]> = {
  TRAD: [],
  SEL: ['Costela de boi ou costela de porco'],
  CHO: ['Salmão ou camarão', 'Costela de boi ou costela de porco'],
  PRI: [
    'Carré de cordeiro',
    'Salmão ou camarão',
    'Costela de boi ou costela de porco',
  ],
  LUX: [
    'Picanha Wagyu',
    'Lagosta ou Vieira com bacon',
    'Salmão ou camarão',
    'Costela de boi ou costela de porco',
    'Carré de cordeiro',
  ],
  PERS: [],
}

const PACKAGE_HIGHLIGHTS_PT: Record<PackageCommercialTier, readonly string[]> = {
  LUX: [
    'Picanha Wagyu',
    'Lagosta ou Vieira com bacon',
    'Salmão ou camarão',
    'Costela de boi ou costela de porco',
    'Experiência luxury completa',
  ],
  PRI: [
    'Carré de cordeiro',
    'Salmão ou camarão',
    'Costela de boi ou costela de porco',
    'Experiência premium completa',
  ],
  CHO: [
    'Salmão ou camarão',
    'Costela de boi ou costela de porco',
    'Opção premium sem carré de cordeiro',
  ],
  SEL: [
    'Costela de boi ou costela de porco',
    'Opção intermediária com upgrade de proteína',
  ],
  TRAD: [
    'Churrasco tradicional CDL',
    'Melhor opção de entrada',
    'Seleção clássica para eventos',
  ],
  PERS: [
    'Montado conforme necessidade do cliente',
    'Itens definidos manualmente',
    'Ideal para eventos customizados',
  ],
}

type PackageDescriptionFields = PackageFieldSource & {
  items_description_pt?: string | null
  items_description_en?: string | null
  items_description_es?: string | null
  garnish_description_pt?: string | null
  garnish_description_en?: string | null
  garnish_description_es?: string | null
  sides_description_pt?: string | null
  sides_description_en?: string | null
  sides_description_es?: string | null
  package_highlights_pt?: string | null
  package_highlights_en?: string | null
  package_highlights_es?: string | null
}

const PACKAGE_TIER_NAMES: Record<
  (typeof PACKAGE_TIER_ORDER)[number],
  string
> = {
  PRI: 'Prime',
  LUX: 'Luxury',
  CHO: 'Choice',
  SEL: 'Select',
  TRAD: 'Traditional',
  PERS: 'Personalized',
}

function detectPackageTier(
  packageKey: string,
): PackageCommercialTier | null {
  const key = packageKey.toUpperCase().replace(/\+$/, '')
  for (const tier of PACKAGE_TIER_ORDER) {
    if (key.includes(tier)) return tier
  }
  return null
}

function buildTierItemsDescription(
  tier: PackageCommercialTier,
  language: QuoteLanguage = 'pt',
): string {
  if (tier === 'PERS') {
    return translateCdlItem(
      'Itens definidos conforme necessidade do evento.',
      language,
    )
  }

  const items = [
    ...TRADITIONAL_BASE_ITEMS,
    ...TIER_EXTRA_ITEMS[tier],
    ...TRADITIONAL_COMMON_ITEMS,
  ]
  return translateCdlItemList(items, language).join(' • ')
}

export function getPackageItemsDescription(
  pkg: PackageFieldSource | null | undefined,
  language: 'pt' | 'en' | 'es' = 'pt',
): string {
  if (!pkg) return ''

  const extended = pkg as PackageDescriptionFields
  const dedicated =
    language === 'en'
      ? extended.items_description_en?.trim()
      : language === 'es'
        ? extended.items_description_es?.trim()
        : extended.items_description_pt?.trim()
  if (dedicated) return dedicated

  const fromPt = extended.items_description_pt?.trim()
  if (fromPt) return translateCdlJoinedList(fromPt, language)

  const parsed = packageItemsDescription(pkg, language)
  if (parsed?.trim()) return parsed

  const tier = detectPackageTier(getPackageKey(pkg))
  if (!tier) return ''

  return buildTierItemsDescription(tier, language)
}

export function getPackageHighlights(
  pkg: PackageFieldSource | null | undefined,
  language: 'pt' | 'en' | 'es' = 'pt',
): string {
  if (!pkg) return ''

  const extended = pkg as PackageDescriptionFields
  const dedicated =
    language === 'en'
      ? extended.package_highlights_en?.trim()
      : language === 'es'
        ? extended.package_highlights_es?.trim()
        : extended.package_highlights_pt?.trim()
  if (dedicated) return formatPackageBulletText(dedicated)

  const fromPt = extended.package_highlights_pt?.trim()
  if (fromPt) {
    return formatPackageBulletText(translateCdlJoinedList(fromPt, language))
  }

  const tier = detectPackageTier(getPackageKey(pkg))
  if (!tier) return ''

  return translateCdlItemList(PACKAGE_HIGHLIGHTS_PT[tier], language).join(' • ')
}

export function getPackageTierSortIndex(
  pkg: PackageFieldSource | null | undefined,
): number {
  const tier = detectPackageTier(getPackageKey(pkg))
  if (!tier) return PACKAGE_TIER_ORDER.length
  return PACKAGE_TIER_ORDER.indexOf(tier)
}

/** Traditional → Select → Choice → Luxury → Prime → Personalized */
export function sortPackagesByCommercialTier<
  T extends PackageFieldSource,
>(packages: ReadonlyArray<T>): T[] {
  return [...packages].sort((a, b) => {
    const rankDiff = getPackageTierSortIndex(a) - getPackageTierSortIndex(b)
    if (rankDiff !== 0) return rankDiff
    return getPackageKey(a).localeCompare(getPackageKey(b))
  })
}

export function getPackageItemsDisplayText(
  pkg: PackageFieldSource | null | undefined,
  language: 'pt' | 'en' | 'es' = 'pt',
): string {
  return getPackageItemsDescription(pkg, language)
}

export function getPackageGarnishDisplayText(
  pkg: PackageFieldSource | null | undefined,
  language: 'pt' | 'en' | 'es' = 'pt',
): string {
  if (!getPackageHasGarnish(pkg)) {
    return language === 'en'
      ? 'Not included'
      : language === 'es'
        ? 'No incluidas'
        : 'Não inclusas'
  }

  const extended = (pkg ?? null) as PackageDescriptionFields | null
  const dedicated =
    pickLocalizedText(
      {
        pt: extended?.garnish_description_pt || extended?.sides_description_pt,
        en: extended?.garnish_description_en || extended?.sides_description_en,
        es: extended?.garnish_description_es || extended?.sides_description_es,
      },
      language,
    ).trim()
  if (dedicated) {
    const sourceIsDedicated =
      language === 'en'
        ? Boolean(
            extended?.garnish_description_en?.trim() ||
              extended?.sides_description_en?.trim(),
          )
        : language === 'es'
          ? Boolean(
              extended?.garnish_description_es?.trim() ||
                extended?.sides_description_es?.trim(),
            )
          : true
    return formatPackageBulletText(
      sourceIsDedicated ? dedicated : translateCdlJoinedList(dedicated, language),
    )
  }

  const parsed = garnishDescription(pkg ?? null, language)
  if (parsed?.trim()) return formatPackageBulletText(parsed)

  return translateCdlJoinedList(DEFAULT_GARNISH_TEXT_PT, language)
}

export function getPackageGroupSummaryCodes(
  packages: ReadonlyArray<{ package_key?: string | null }>,
): string {
  return sortPackagesByCommercialTier(packages)
    .map((pkg) => getPackageKey(pkg))
    .filter(Boolean)
    .join(' · ')
}

/** Quebra highlights do banco (• ou quebra de linha) em itens de lista. */
export function parsePackageHighlightsText(
  text: string | null | undefined,
): string[] {
  const raw = String(text ?? '').trim()
  if (!raw) return []

  return raw
    .split(/\s*•\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Converte texto com vírgulas ou quebras em lista com bullet • */
export function formatPackageBulletText(text: string | null | undefined): string {
  const raw = String(text ?? '').trim()
  if (!raw) return ''

  if (raw.includes('•')) return raw

  return raw
    .split(/\s*[,;]\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' • ')
}

/** Nome comercial genérico (label_en ou fallback). */
export function getPackageCommercialName(
  pkg: PackageFieldSource | null | undefined,
): string {
  if (!pkg) return '—'
  const tier = detectPackageTier(getPackageKey(pkg))
  if (tier) return PACKAGE_TIER_NAMES[tier]
  return (
    pkg.label_en?.trim() ||
    pkg.package_name?.trim() ||
    pkg.label_pt?.trim() ||
    getPackageKey(pkg) ||
    '—'
  )
}

/** Segunda cascata: BBQ Prime, BBQ Choice, BBQ Personalizado, etc. */
export function getPackageCascadeFriendlyLabel(
  pkg: PackageFieldSource | null | undefined,
  language: QuoteLanguage = 'pt',
): string {
  const tier = detectPackageTier(getPackageKey(pkg))
  if (!tier) return getPackageCommercialName(pkg)
  if (tier === 'PERS') {
    if (language === 'en') return 'BBQ Personalized'
    return 'BBQ Personalizado'
  }
  return `BBQ ${PACKAGE_TIER_NAMES[tier]}`
}

/** Pacote padrão ao abrir Etapa 3: BBQPRI+ (Com guarnições / Prime). */
export function findDefaultQuotePackage<
  T extends PackageFieldSource & { id?: string },
>(packages: ReadonlyArray<T>): T | null {
  const withSides = packages.filter((pkg) => getPackageHasGarnish(pkg))
  const sorted = sortPackagesByCommercialTier(withSides)
  const byKey = sorted.find(
    (pkg) => getPackageKey(pkg).toUpperCase() === 'BBQPRI+',
  )
  return byKey ?? sorted[0] ?? null
}

/** Card de detalhe na cotação: BBQ Choice com guarnições, etc. */
export function getPackageDetailTitle(
  pkg: PackageFieldSource | null | undefined,
  language: QuoteLanguage = 'pt',
): string {
  const friendly = getPackageCascadeFriendlyLabel(pkg, language)
  if (!getPackageHasGarnish(pkg)) return friendly
  if (language === 'en') return `${friendly} with sides`
  if (language === 'es') return `${friendly} con guarniciones`
  return `${friendly} com guarnições`
}
