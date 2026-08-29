import { getPackageKey, type PackageFieldSource } from '@/Lib/packageFieldAccess'
import {
  getBlockedCatalogItemIdsFromConfig,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import { resolveCatalogItemDisplayLabel } from '@/Lib/cdlPackageItemI18n'
import { resolveSausageDisplayLabel } from '@/Lib/publicQuote/sausageOptions'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'

export type PackageOptionGroupItem = {
  id: string
  company_id?: string | null
  option_group_id: string
  additional_item_id?: string | null
  option_item_key?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  display_order?: number | null
  active?: boolean | null
  price_delta?: number | null
}

export type PackageOptionGroupRecord = {
  id: string
  company_id?: string | null
  package_id: string
  option_group_key: string
  group_key?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  min_choices?: number | null
  max_choices?: number | null
  required?: boolean | null
  blocks_additional_items?: boolean | null
  display_order?: number | null
  active?: boolean | null
  items?: PackageOptionGroupItem[]
}

export type PackageOptionGroup = PackageOptionGroupRecord & {
  items: PackageOptionGroupItem[]
}

export type QuotePackageSelection = {
  id: string
  company_id?: string | null
  quote_id: string
  package_id: string
  option_group_id: string
  option_item_id: string
}

export type PackageSelectionLabel = {
  groupId: string
  groupTitle: string
  itemId: string
  itemLabel: string
}

export function getOptionItemLabel(
  item: PackageOptionGroupItem,
  language: QuoteLanguage = 'pt',
): string {
  const sausageLabel = resolveSausageDisplayLabel(item, language)
  if (sausageLabel) return sausageLabel
  return (
    resolveCatalogItemDisplayLabel(
      {
        pt: item.label_pt,
        en: item.label_en,
        es: item.label_es,
        fallback: item.option_item_key,
      },
      language,
    ) || '—'
  )
}

export function getOptionGroupTitle(
  group: PackageOptionGroup,
  language: QuoteLanguage = 'pt',
): string {
  if (language === 'en') {
    return (
      group.label_en?.trim() ||
      group.label_pt?.trim() ||
      group.option_group_key
    )
  }
  if (language === 'es') {
    return (
      group.label_es?.trim() ||
      group.label_pt?.trim() ||
      group.option_group_key
    )
  }
  return group.label_pt?.trim() || group.option_group_key
}

export function isCustomPackage(
  pkg: PackageFieldSource | null | undefined,
): boolean {
  const key = getPackageKey(pkg).toUpperCase()
  return /\bPERS\b|BBQPERS/i.test(key)
}

export function isRequiredOptionGroup(group: PackageOptionGroup): boolean {
  return group.required === true
}

export function hasPackageIncludedChoices(
  packageId: string | null | undefined,
  groups: ReadonlyArray<PackageOptionGroup>,
  pkg: PackageFieldSource | null | undefined,
): boolean {
  if (!packageId?.trim() || isCustomPackage(pkg)) return false
  return getPackageOptionGroupsForPackage(packageId, groups).length > 0
}

function sortGroups(
  groups: ReadonlyArray<PackageOptionGroupRecord>,
): PackageOptionGroup[] {
  return [...groups]
    .filter((group) => group.active !== false)
    .sort(
      (a, b) =>
        Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
        a.option_group_key.localeCompare(b.option_group_key),
    )
    .map((group) => ({
      ...group,
      items: [...(group.items ?? [])]
        .filter((item) => item.active !== false)
        .sort(
          (a, b) =>
            Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
            getOptionItemLabel(a).localeCompare(getOptionItemLabel(b), 'pt-BR'),
        ),
    }))
}

function packageIdsMatch(
  packageId: string,
  groupPackageId: string | null | undefined,
): boolean {
  return groupPackageId?.trim() === packageId.trim()
}

export function flattenPackageOptionGroupItems(
  groups: ReadonlyArray<PackageOptionGroupRecord>,
  groupItems?: ReadonlyArray<PackageOptionGroupItem>,
): PackageOptionGroupItem[] {
  if (groupItems?.length) {
    return [...groupItems]
  }
  return groups.flatMap((group) =>
    (group.items ?? []).map((item) => ({
      ...item,
      option_group_id: item.option_group_id || group.id,
    })),
  )
}

/**
 * Anexa itens aos grupos no código — não depende de join Supabase.
 */
export function mergeOptionGroupsForPackage(
  packageId: string,
  groups: ReadonlyArray<PackageOptionGroupRecord>,
  groupItems: ReadonlyArray<PackageOptionGroupItem>,
  options?: { includeEmptyGroups?: boolean },
): PackageOptionGroup[] {
  if (!packageId?.trim()) return []

  const normalizedId = packageId.trim()
  const groupsForPackage = [...groups]
    .filter(
      (group) =>
        packageIdsMatch(normalizedId, group.package_id) &&
        group.active !== false,
    )
    .sort(
      (a, b) =>
        Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
        (a.option_group_key ?? '').localeCompare(b.option_group_key ?? ''),
    )

  const merged: PackageOptionGroup[] = groupsForPackage.map((group) => {
    const groupId = group.id.trim()
    const items = groupItems
      .filter(
        (item) =>
          item.option_group_id?.trim() === groupId && item.active !== false,
      )
      .sort(
        (a, b) =>
          Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
          (a.label_pt ?? '').localeCompare(b.label_pt ?? '', 'pt-BR'),
      )
      .map((item) => ({ ...item, option_group_id: groupId }))

    return {
      ...group,
      option_group_key:
        group.option_group_key?.trim() || group.group_key?.trim() || '',
      items,
    }
  })

  if (options?.includeEmptyGroups) return merged
  return merged.filter((group) => group.items.length > 0)
}

export function getPackageOptionGroupsForPackage(
  packageId: string,
  groups: ReadonlyArray<PackageOptionGroupRecord>,
  groupItems?: ReadonlyArray<PackageOptionGroupItem>,
): PackageOptionGroup[] {
  if (!packageId?.trim()) return []

  if (groupItems) {
    return mergeOptionGroupsForPackage(packageId, groups, groupItems)
  }

  return sortGroups(
    groups.filter((group) => packageIdsMatch(packageId, group.package_id)),
  ).filter((group) => (group.items?.length ?? 0) > 0) as PackageOptionGroup[]
}

export function getBlockedCatalogItemIds(
  packageId: string,
  groups: ReadonlyArray<PackageOptionGroupRecord>,
  customPackage: boolean,
  options?: {
    packageItems?: ReadonlyArray<PackageItem>
    packageSideItems?: ReadonlyArray<PackageSideItem>
    groupItems?: ReadonlyArray<PackageOptionGroupItem>
    /** groupId → package_option_group_items.id */
    selectedPackageOptions?: Record<string, string>
  },
): string[] {
  const mergedGroups: PackageOptionGroup[] = options?.groupItems
    ? mergeOptionGroupsForPackage(packageId, groups, options.groupItems, {
        includeEmptyGroups: true,
      })
    : (groups as PackageOptionGroup[]).map((group) => ({
        ...group,
        items: group.items ?? [],
      }))

  return getBlockedCatalogItemIdsFromConfig({
    packageId,
    packageItems: options?.packageItems ?? [],
    packageSideItems: options?.packageSideItems ?? [],
    optionGroups: mergedGroups,
    optionGroupItems: options?.groupItems,
    customPackage,
    selectedPackageOptions: options?.selectedPackageOptions ?? {},
  })
}

/** @deprecated Use getBlockedCatalogItemIds */
export const getBlockedAdditionalItemIds = getBlockedCatalogItemIds

export function getPendingPackageSelectionGroupIds(
  groups: ReadonlyArray<PackageOptionGroup>,
  selections: Record<string, string>,
): string[] {
  return sortGroups([...groups])
    .filter(
      (group) =>
        isRequiredOptionGroup(group) &&
        group.items.length > 0 &&
        !selections[group.id]?.trim(),
    )
    .map((group) => group.id)
}

export function validatePackageSelections(
  groups: ReadonlyArray<PackageOptionGroup>,
  selections: Record<string, string>,
  language: QuoteLanguage = 'pt',
): string[] {
  const pending = getPendingPackageSelectionGroupIds(groups, selections)
  if (pending.length > 0) {
    return [tw(language, 'chooseOption')]
  }
  return []
}

function buildGroupPlaceholderPattern(
  group: PackageOptionGroup,
  language: QuoteLanguage,
): string | null {
  const labels = group.items
    .map((item) => getOptionItemLabel(item, language))
    .filter(Boolean)
  if (labels.length === 0) return null
  if (labels.length === 1) return labels[0]
  return labels.join(` ${tw(language, 'listOr')} `)
}

export function resolvePackageItemsWithSelections(
  itemsText: string,
  selections: Record<string, string>,
  groups: ReadonlyArray<PackageOptionGroup>,
  language: QuoteLanguage = 'pt',
): string {
  let result = itemsText

  for (const group of sortGroups([...groups])) {
    const selectedId = selections[group.id]?.trim()
    if (!selectedId) continue

    const selectedItem = group.items.find((item) => item.id === selectedId)
    if (!selectedItem) continue

    const selectedLabel = getOptionItemLabel(selectedItem, language)
    const pattern = buildGroupPlaceholderPattern(group, language)
    if (pattern && result.includes(pattern)) {
      result = result.replace(pattern, selectedLabel)
      continue
    }

    const bulletPattern = group.items
      .map((item) => getOptionItemLabel(item, language))
      .filter(Boolean)
      .join(' • ')
    if (bulletPattern && result.includes(bulletPattern)) {
      result = result.replace(bulletPattern, selectedLabel)
      continue
    }

    const keyPattern = group.items
      .map((item) => item.option_item_key?.trim())
      .filter(Boolean)
      .join(` ${tw(language, 'listOr')} `)
    if (keyPattern && result.includes(keyPattern)) {
      result = result.replace(
        keyPattern,
        selectedItem.option_item_key?.trim() || selectedLabel,
      )
    }
  }

  return result
}

export function buildPackageSelectionLabels(
  selections: Record<string, string>,
  groups: ReadonlyArray<PackageOptionGroup>,
  language: QuoteLanguage = 'pt',
): PackageSelectionLabel[] {
  const labels: PackageSelectionLabel[] = []

  for (const group of sortGroups([...groups])) {
    const selectedId = selections[group.id]?.trim()
    if (!selectedId) continue
    const item = group.items.find((row) => row.id === selectedId)
    if (!item) continue
    labels.push({
      groupId: group.id,
      groupTitle: getOptionGroupTitle(group, language),
      itemId: item.id,
      itemLabel: getOptionItemLabel(item, language),
    })
  }

  return labels
}

export function packageSelectionsFromRows(
  rows: ReadonlyArray<Pick<QuotePackageSelection, 'option_group_id' | 'option_item_id'>>,
): Record<string, string> {
  const selections: Record<string, string> = {}
  for (const row of rows) {
    if (row.option_group_id && row.option_item_id) {
      selections[row.option_group_id] = row.option_item_id
    }
  }
  return selections
}

export function formatPackageOptionGroupsSummary(
  groups: ReadonlyArray<PackageOptionGroup>,
  language: QuoteLanguage = 'pt',
): string[] {
  return groups.map((group) => {
    const title = getOptionGroupTitle(group, language)
    const labels = group.items
      .map((item) => getOptionItemLabel(item, language))
      .filter(Boolean)
      .join(' / ')
    return labels ? `${title}: ${labels}` : title
  })
}

export function prunePackageSelectionsForPackage(
  packageId: string,
  selections: Record<string, string>,
  groups: ReadonlyArray<PackageOptionGroupRecord>,
  groupItems?: ReadonlyArray<PackageOptionGroupItem>,
): Record<string, string> {
  const validGroupIds = new Set(
    getPackageOptionGroupsForPackage(packageId, groups, groupItems).map(
      (group) => group.id,
    ),
  )
  const next: Record<string, string> = {}
  for (const [groupId, itemId] of Object.entries(selections)) {
    if (validGroupIds.has(groupId) && itemId?.trim()) {
      next[groupId] = itemId
    }
  }
  return next
}
