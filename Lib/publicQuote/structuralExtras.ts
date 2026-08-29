export const GRILL_RENTAL_ITEM_KEY = 'ITEM_084'
export const WAITER_SERVICE_ITEM_KEY = 'CDL_WAITER_SERVICE'
export const DISPOSABLE_KIT_ITEM_KEY = 'KIT_DESCARTAVEIS'

export const SUGGESTED_PUBLIC_EXTRA_ITEM_KEYS = [
  'ITEM_012',
  'ITEM_013',
  'ITEM_011',
  'ITEM_016',
] as const

const STRUCTURAL_PUBLIC_EXTRA_ITEM_KEYS = new Set([
  GRILL_RENTAL_ITEM_KEY,
  WAITER_SERVICE_ITEM_KEY,
  DISPOSABLE_KIT_ITEM_KEY,
])

const WEIGHT_UOMS = new Set(['LB', 'LBS', 'POUND', 'POUNDS', 'KG', 'G', 'OZ'])

export type StructuralExtraItem = {
  id?: string | null
  item_key?: string | null
  quantity_2?: number | null
  uom_2?: string | null
}

export function normalizeCatalogItemKey(
  itemKey: string | null | undefined,
): string {
  return itemKey?.trim().toUpperCase() ?? ''
}

export function isGrillRentalCatalogItem(
  item: StructuralExtraItem | null | undefined,
): boolean {
  return normalizeCatalogItemKey(item?.item_key) === GRILL_RENTAL_ITEM_KEY
}

export function isWaiterServiceCatalogItem(
  item: StructuralExtraItem | null | undefined,
): boolean {
  return normalizeCatalogItemKey(item?.item_key) === WAITER_SERVICE_ITEM_KEY
}

export function isDisposableKitCatalogItem(
  item: StructuralExtraItem | null | undefined,
): boolean {
  return normalizeCatalogItemKey(item?.item_key) === DISPOSABLE_KIT_ITEM_KEY
}

export function isStructuralPublicExtraItem(
  item: StructuralExtraItem | null | undefined,
): boolean {
  return STRUCTURAL_PUBLIC_EXTRA_ITEM_KEYS.has(
    normalizeCatalogItemKey(item?.item_key),
  )
}

export function isSuggestedPublicExtraItem(
  item: StructuralExtraItem | null | undefined,
): boolean {
  const key = normalizeCatalogItemKey(item?.item_key)
  return (SUGGESTED_PUBLIC_EXTRA_ITEM_KEYS as readonly string[]).includes(key)
}

export function suggestedPublicExtraSortIndex(
  item: StructuralExtraItem | null | undefined,
): number {
  const key = normalizeCatalogItemKey(item?.item_key)
  const index = (SUGGESTED_PUBLIC_EXTRA_ITEM_KEYS as readonly string[]).indexOf(
    key,
  )
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

export function isWeightUom(uom: string | null | undefined): boolean {
  return WEIGHT_UOMS.has(String(uom ?? '').trim().toUpperCase())
}

export function hasCatalogWeight(
  item: StructuralExtraItem | null | undefined,
): boolean {
  const amount = Number(item?.quantity_2)
  return Number.isFinite(amount) && amount > 0 && isWeightUom(item?.uom_2)
}

export function sanitizePublicAdditionalQuantity(value: unknown): number {
  if (typeof value === 'boolean') return 0
  if (typeof value === 'string' && !/^\s*\d+\s*$/.test(value)) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return 0
  return Math.min(10_000, parsed)
}

export function partitionSuggestedPublicExtras<T extends StructuralExtraItem>(
  items: ReadonlyArray<T>,
): { suggested: T[]; remaining: T[] } {
  const suggested: T[] = []
  const remaining: T[] = []
  for (const item of items) {
    if (isSuggestedPublicExtraItem(item)) suggested.push(item)
    else remaining.push(item)
  }
  suggested.sort(
    (a, b) => suggestedPublicExtraSortIndex(a) - suggestedPublicExtraSortIndex(b),
  )
  return { suggested, remaining }
}
