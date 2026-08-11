import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import { lookupCatalogItemById } from '@/Lib/catalogItemVisual'
import {
  getDisplayableFixedPackageItems,
  getPackageItemLabel,
  getPackageSideItemLabel,
  getPackageSideItemsForPackage,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroup,
  PackageOptionGroupItem,
} from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'
import { pickLocalizedText } from '@/Lib/i18n/locales'

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

const CATEGORY_LABELS: Record<PackageItemDisplayCategory, string> = {
  carnes: 'Carnes',
  linguicas: 'Linguiças',
  itens: 'Itens do pacote',
  condimentos: 'Condimentos internos',
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
      label: CATEGORY_LABELS[category],
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
