/**
 * Resolution + partition for the virtual Suggested Extras row.
 * No catalog writes. Safe to import from Node tests (no @/ aliases).
 */

export const SUGGESTED_EXTRAS_DISPLAY_KEY = 'SUGGESTED_EXTRAS'

/**
 * Promoted extras, identified by canonical item_key.
 * Prices are never stored here; they always come from the live item.
 */
export const SUGGESTED_EXTRA_ITEM_KEYS = [
  'ITEM_013', // Tomahawk Wagyu
  'ITEM_012', // Tomahawk Angus
  'ITEM_011', // T-Bone Angus
  'ITEM_016', // Pururuca / Torresmo Pururuca
] as const

/** Stable catalog ids as a second resolution path if item_key is missing. */
export const SUGGESTED_EXTRA_ITEM_IDS = [
  '0d7a294c-d03d-42eb-922b-a2abffd6deeb',
  'e395bf13-d94a-47d8-8f08-78b9c8b07c9f',
  'a10040e4-7d9e-4093-aaf8-92f536f38b7f',
  'd9850859-5ce4-4bfc-a3e9-04886ee41baa',
] as const

const SUGGESTED_EXTRA_LABEL_FALLBACKS = [
  'TOMAHAWK WAGYU',
  'TOMAHAWK ANGUS',
  'T BONE ANGUS',
  'PURURUCA',
  'TORRESMO PURURUCA',
] as const

const SUGGESTED_KEY_SET = new Set<string>(SUGGESTED_EXTRA_ITEM_KEYS)
const SUGGESTED_ID_SET = new Set<string>(SUGGESTED_EXTRA_ITEM_IDS)
const SUGGESTED_LABEL_SET = new Set<string>(SUGGESTED_EXTRA_LABEL_FALLBACKS)

export type SuggestedExtraCandidate = {
  id: string
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
}

function normalizeSuggestedLabel(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toUpperCase()
}

function itemKeyOf(item: SuggestedExtraCandidate): string {
  return item.item_key?.trim().toUpperCase() ?? ''
}

export function isSuggestedExtraItem(item: SuggestedExtraCandidate): boolean {
  const key = itemKeyOf(item)
  if (key && SUGGESTED_KEY_SET.has(key)) return true
  if (item.id && SUGGESTED_ID_SET.has(item.id)) return true

  const labels = [
    item.label_pt,
    item.label_en,
    item.label_es,
    item.item_name,
  ].map(normalizeSuggestedLabel)
  return labels.some((label) => labelMatchesSuggestedFallback(label))
}

function labelMatchesSuggestedFallback(label: string): boolean {
  if (!label) return false
  if (SUGGESTED_LABEL_SET.has(label)) return true
  for (const fallback of SUGGESTED_EXTRA_LABEL_FALLBACKS) {
    if (label === fallback || label.startsWith(`${fallback} `)) return true
  }
  return false
}

/**
 * Suggested extras are chosen from the already-visible list, so active,
 * customer_visible, can_be_additional and eligibility stay intact.
 * Missing or ineligible products are skipped — never invented.
 * Sort is applied by the caller with the canonical unit-price helper.
 */
export function pickSuggestedExtraItems<T extends SuggestedExtraCandidate>(
  visibleItems: ReadonlyArray<T>,
): T[] {
  const seen = new Set<string>()
  const picked: T[] = []
  for (const item of visibleItems) {
    if (!isSuggestedExtraItem(item) || seen.has(item.id)) continue
    seen.add(item.id)
    picked.push(item)
  }
  return picked
}

export function partitionSuggestedExtraItems<T extends SuggestedExtraCandidate>(
  visibleItems: ReadonlyArray<T>,
): { suggestedItems: T[]; remainingItems: T[] } {
  const suggestedItems = pickSuggestedExtraItems(visibleItems)
  const suggestedIds = new Set(suggestedItems.map((item) => item.id))
  const remainingItems = visibleItems.filter((item) => !suggestedIds.has(item.id))
  return { suggestedItems, remainingItems }
}

export function displayGroupsHaveDuplicateItemIds<
  T extends { id: string },
>(groups: ReadonlyArray<{ items: ReadonlyArray<T> }>): boolean {
  const seen = new Set<string>()
  for (const group of groups) {
    for (const item of group.items) {
      if (seen.has(item.id)) return true
      seen.add(item.id)
    }
  }
  return false
}
