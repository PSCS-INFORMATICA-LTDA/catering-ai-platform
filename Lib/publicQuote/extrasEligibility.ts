import { isPublicCatalogFixtureItem } from './catalogVisibility.ts'

export type ExtraEligibilityItem = {
  id: string
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  category_key?: string | null
  item_type?: string | null
  active?: boolean | null
  customer_visible?: boolean | null
  can_be_additional?: boolean | null
  operational_item?: boolean | null
}

/**
 * Canonical catalog ids already included in the current package composition
 * or selected option. Presence of additional_item_id is enough — the same
 * physical SKU must not be sold again as an extra.
 */
export function collectBlockedCatalogItemIds(
  rows: ReadonlyArray<{ additional_item_id?: string | null }>,
): string[] {
  const blocked = new Set<string>()
  for (const row of rows) {
    const catalogItemId = row.additional_item_id?.trim()
    if (catalogItemId) blocked.add(catalogItemId)
  }
  return [...blocked]
}

function isCustomerAdditionalCandidate(item: ExtraEligibilityItem): boolean {
  if (item.active === false) return false
  if (item.customer_visible === false) return false
  if (item.can_be_additional !== true) return false
  if (item.operational_item === true) return false
  const itemType = item.item_type?.trim().toUpperCase()
  if (
    itemType !== 'PRODUCT' &&
    itemType !== 'PACKAGE_ITEM' &&
    itemType !== 'SIDE' &&
    itemType !== 'EQUIPMENT'
  ) {
    return false
  }
  if (
    itemType === 'PACKAGE_ITEM' &&
    item.category_key?.trim().toUpperCase() === 'CONDIMENTOS'
  ) {
    return false
  }
  if (isPublicCatalogFixtureItem(item)) return false
  return true
}

/**
 * Extra candidates shown to the customer for the current package state.
 * Identity is catalog item id — never translated labels.
 */
export function getVisiblePublicExtraItems<T extends ExtraEligibilityItem>(
  items: ReadonlyArray<T>,
  blockedCatalogItemIds: ReadonlyArray<string>,
): T[] {
  const blocked = new Set(
    blockedCatalogItemIds.map((id) => id.trim()).filter(Boolean),
  )
  return items.filter(
    (item) => isCustomerAdditionalCandidate(item) && !blocked.has(item.id),
  )
}

export function extraIdsIntersectingIncluded(
  visibleExtraIds: ReadonlyArray<string>,
  includedCatalogItemIds: ReadonlyArray<string>,
): string[] {
  const included = new Set(
    includedCatalogItemIds.map((id) => id.trim()).filter(Boolean),
  )
  return visibleExtraIds.filter((id) => included.has(id.trim()))
}

/**
 * Drop extra quantities whose catalog id is now included in the package
 * (base composition or a selected option). Prevents duplicate charge.
 */
export function pruneBlockedAdditionalSelections(
  additionals: Record<string, number>,
  blockedCatalogItemIds: ReadonlyArray<string>,
): { additionals: Record<string, number>; removedIds: string[] } {
  const blocked = new Set(
    blockedCatalogItemIds.map((id) => id.trim()).filter(Boolean),
  )
  const removedIds: string[] = []
  const next: Record<string, number> = { ...additionals }
  for (const [itemId, quantity] of Object.entries(next)) {
    if (!blocked.has(itemId)) continue
    if (!quantity) continue
    delete next[itemId]
    removedIds.push(itemId)
  }
  return { additionals: next, removedIds }
}
