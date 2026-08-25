import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import { lookupCatalogItemById } from '@/Lib/catalogItemVisual'
import {
  PACKAGE_COMMON_ITEMS,
  SIDES_ITEMS,
} from '@/Lib/cdlCommercialRules'
import {
  getDisplayableFixedPackageItems,
  getPackageItemLabel,
  getPackageSideItemLabel,
  getPackageSideItemsForPackage,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import {
  getOptionItemLabel,
  type PackageOptionGroup,
  type PackageOptionGroupItem,
} from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'
import { pickLocalizedText } from '@/Lib/i18n/locales'
import { translateCdlItemList } from '@/Lib/cdlPackageItemI18n'

const OPTION_GROUP_ORDER: Record<string, number> = {
  SEAFOOD_OPTION: 0,
  COSTELA_OPTION: 1,
  SIDE_OPTION: 2,
}

export type PackageItemDisplayCategory =
  | 'carnes'
  | 'linguicas'
  | 'itens'
  | 'condimentos'

function categoryLabel(
  category: PackageItemDisplayCategory,
  language: QuoteLanguage,
): string {
  if (category === 'carnes') return tw(language, 'meatsCategory')
  if (category === 'linguicas') return tw(language, 'sausagesCategory')
  if (category === 'condimentos') return tw(language, 'condimentsCategory')
  return tw(language, 'packageItemsCategory')
}

const CATEGORY_ORDER: PackageItemDisplayCategory[] = [
  'carnes',
  'linguicas',
  'itens',
  'condimentos',
]

function normalizeKey(value: string | null | undefined): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '') ?? ''
  )
}

/** Feijão tropeiro não entra como guarnição inclusa na cotação (regra Caio). */
export function isExcludedInclusiveSide(side: PackageSideItem): boolean {
  const key = normalizeKey(side.item_key)
  const label = normalizeKey(side.label_pt ?? side.item_name)
  return key.includes('tropeiro') || label.includes('tropeiro')
}

export function getQuoteDisplaySideItems(
  packageId: string,
  sides: ReadonlyArray<PackageSideItem>,
): PackageSideItem[] {
  return getPackageSideItemsForPackage(packageId, sides).filter(
    (side) => !isExcludedInclusiveSide(side),
  )
}

export function sortOptionGroupsForQuote(
  groups: ReadonlyArray<PackageOptionGroup>,
): PackageOptionGroup[] {
  return [...groups]
    .filter((group) => group.active !== false)
    .sort((a, b) => {
      const orderA =
        OPTION_GROUP_ORDER[a.option_group_key?.trim().toUpperCase() ?? ''] ??
        Number(a.display_order ?? 99) + 10
      const orderB =
        OPTION_GROUP_ORDER[b.option_group_key?.trim().toUpperCase() ?? ''] ??
        Number(b.display_order ?? 99) + 10
      if (orderA !== orderB) return orderA - orderB
      return Number(a.display_order ?? 0) - Number(b.display_order ?? 0)
    })
    .map((group) => ({
      ...group,
      items: [...(group.items ?? [])]
        .filter((item) => item.active !== false)
        .sort(
          (a, b) =>
            Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
            (a.label_pt ?? '').localeCompare(b.label_pt ?? '', 'pt-BR'),
        ),
    }))
}

export function resolvePackageItemDisplayCategory(
  item: PackageItem,
  catalogItem: CatalogItemListItem | null,
): PackageItemDisplayCategory {
  const catKey = catalogItem?.category_key?.trim().toUpperCase() ?? ''
  const itemType = catalogItem?.item_type?.trim().toUpperCase() ?? ''
  const name = (item.label_pt ?? catalogItem?.label_pt ?? catalogItem?.item_name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (catKey === 'CONDIMENTOS' || (itemType === 'PACKAGE_ITEM' && catKey === 'CONDIMENTOS')) {
    return 'condimentos'
  }

  if (
    catKey.includes('LINGUIC') ||
    name.includes('linguica') ||
    name.includes('saussage')
  ) {
    return 'linguicas'
  }

  if (
    catKey.includes('CARNE') ||
    /picanha|costela|frango|salmao|camarao|cordeiro|bovina|porco|carre|meat|beef|pork|lamb|salmon|shrimp/.test(
      name,
    )
  ) {
    return 'carnes'
  }

  return 'itens'
}

export type PackageItemCategoryGroup = {
  category: PackageItemDisplayCategory
  label: string
  items: Array<{ label: string; item: PackageItem }>
}

export function groupFixedPackageItemsForQuote({
  packageId,
  packageItems,
  catalogItems = [],
  choiceContext,
  language = 'pt',
}: {
  packageId: string
  packageItems: ReadonlyArray<PackageItem>
  catalogItems?: ReadonlyArray<CatalogItemListItem>
  choiceContext?: {
    optionGroups?: ReadonlyArray<PackageOptionGroup>
    optionGroupItems?: ReadonlyArray<PackageOptionGroupItem>
  }
  language?: QuoteLanguage
}): PackageItemCategoryGroup[] {
  const fixedItems = getDisplayableFixedPackageItems(
    packageId,
    packageItems,
    choiceContext,
  )

  const buckets = new Map<PackageItemDisplayCategory, PackageItemCategoryGroup>()

  for (const item of fixedItems) {
    const catalogItem = lookupCatalogItemById(
      catalogItems,
      item.additional_item_id,
    )
    const category = resolvePackageItemDisplayCategory(item, catalogItem)
    const label = getPackageItemLabel(item, language)
    const group = buckets.get(category) ?? {
      category,
      label: categoryLabel(category, language),
      items: [],
    }
    group.items.push({ label, item })
    buckets.set(category, group)
  }

  return CATEGORY_ORDER.filter((key) => buckets.has(key)).map(
    (key) => buckets.get(key)!,
  )
}

export function getCommercialOptionGroupLabel(
  group: {
    option_group_key?: string | null
    label_pt?: string | null
    label_en?: string | null
    label_es?: string | null
  },
  language: QuoteLanguage = 'pt',
): string {
  const key = group.option_group_key?.trim().toUpperCase() ?? ''
  switch (key) {
    case 'SEAFOOD_OPTION':
      return tw(language, 'seafoodOption')
    case 'COSTELA_OPTION':
      return tw(language, 'ribOption')
    case 'SIDE_OPTION':
      return tw(language, 'sideOption')
    default:
      return (
        pickLocalizedText(
          { pt: group.label_pt, en: group.label_en, es: group.label_es },
          language,
        ).trim() ||
        key ||
        tw(language, 'optionFallback')
      )
  }
}

export function getQuoteDisplaySideLabels(
  packageId: string,
  sides: ReadonlyArray<PackageSideItem>,
  language: QuoteLanguage = 'pt',
): string[] {
  return getQuoteDisplaySideItems(packageId, sides).map((side) =>
    getPackageSideItemLabel(side, language),
  )
}

function collectSideOptionNormalizedKeys(
  optionGroups?: ReadonlyArray<PackageOptionGroup>,
): Set<string> {
  const keys = new Set<string>()
  for (const group of optionGroups ?? []) {
    if (group.option_group_key?.trim().toUpperCase() !== 'SIDE_OPTION') continue
    if (group.active === false) continue
    for (const item of group.items ?? []) {
      if (item.active === false) continue
      for (const raw of [
        item.option_item_key,
        item.label_pt,
        item.label_en,
        item.label_es,
      ]) {
        const key = normalizeKey(raw)
        if (key) keys.add(key)
      }
    }
  }
  return keys
}

function isCommonPackageItem(name: string): boolean {
  const key = normalizeKey(name)
  return PACKAGE_COMMON_ITEMS.some((item) => normalizeKey(item) === key)
}

function isSideChoiceItem(
  name: string,
  optionGroups?: ReadonlyArray<PackageOptionGroup>,
): boolean {
  const keys = collectSideOptionNormalizedKeys(optionGroups)
  const key = normalizeKey(name)
  if (keys.size === 0) {
    return key.includes('vinagrete')
  }
  for (const choice of keys) {
    if (choice === key || choice.includes(key) || key.includes(choice)) {
      return true
    }
  }
  return false
}

/** Commercial SIDES_ITEMS minus Farofa (already in the common list) and the SIDE_OPTION choice. */
export function getPlusGuarnicoesFixedSideItems(
  optionGroups?: ReadonlyArray<PackageOptionGroup>,
): string[] {
  return SIDES_ITEMS.filter(
    (name) =>
      !isCommonPackageItem(name) && !isSideChoiceItem(name, optionGroups),
  )
}

export function getPlusGuarnicoesFixedSideLabels(
  language: QuoteLanguage,
  optionGroups?: ReadonlyArray<PackageOptionGroup>,
): string[] {
  return translateCdlItemList(
    getPlusGuarnicoesFixedSideItems(optionGroups),
    language,
  )
}

/**
 * Display-only names for the four sides shown on COM GUARNIÇÕES arts and
 * the editorial block. Vinagrete is presented here even though the live
 * SIDE_OPTION group still offers Caesar as a later choice. Farofa stays
 * under ACOMPANHAM. Keys stay in SIDES_ITEMS — this does not change charge.
 */
export const PRESENTED_PLUS_SIDE_KEYS = [
  'Arroz branco',
  'Feijão preto',
  'Maionese',
  'Vinagrete',
] as const

const PRESENTED_PLUS_SIDE_LABELS: Record<QuoteLanguage, readonly string[]> = {
  pt: ['ARROZ BRANCO', 'FEIJÃO PRETO', 'MAIONESE', 'VINAGRETE'],
  en: ['WHITE RICE', 'BLACK BEANS', 'POTATO SALAD', 'VINAIGRETTE'],
  es: ['ARROZ BLANCO', 'FRIJOLES NEGROS', 'ENSALADA DE PAPA', 'VINAGRETA'],
}

export function getPresentedPlusSideLabels(language: QuoteLanguage): string[] {
  return [...PRESENTED_PLUS_SIDE_LABELS[language]]
}

export function toPublicSidesDisplayLabel(
  label: string,
  language: QuoteLanguage,
): string {
  const locale = language === 'pt' ? 'pt-BR' : language
  return label.toLocaleUpperCase(locale)
}

export function getPlusGuarnicoesChoiceLabels(
  optionGroups: ReadonlyArray<PackageOptionGroup> | undefined,
  language: QuoteLanguage,
): string[] {
  const group = (optionGroups ?? []).find(
    (item) =>
      item.option_group_key?.trim().toUpperCase() === 'SIDE_OPTION' &&
      item.active !== false,
  )
  if (!group) return []
  return [...(group.items ?? [])]
    .filter((item) => item.active !== false)
    .sort(
      (a, b) =>
        Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
        (a.label_pt ?? '').localeCompare(b.label_pt ?? '', 'pt-BR'),
    )
    .map((item) => getOptionItemLabel(item, language))
    .filter((label) => label && label !== '—')
}

export function plusGuarnicoesHasCaesarChoice(
  optionGroups?: ReadonlyArray<PackageOptionGroup>,
): boolean {
  return [...collectSideOptionNormalizedKeys(optionGroups)].some(
    (key) => key.includes('cesar') || key.includes('caesar'),
  )
}
