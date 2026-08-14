export type AdditionalCategoryGroupLike = {
  categoryKey: string
  items: ReadonlyArray<unknown>
}

/** Chaves estáveis das categorias visíveis com ao menos um item. */
export function getVisibleAdditionalCategoryKeys(
  groups: ReadonlyArray<AdditionalCategoryGroupLike>,
): string[] {
  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => group.categoryKey)
}

export function toVisitedCategorySet(
  visited: ReadonlySet<string> | readonly string[] | undefined,
): Set<string> {
  if (visited instanceof Set) return new Set(visited)
  return new Set(visited ?? [])
}

export function areAllAdditionalCategoriesVisited(
  categoryKeys: readonly string[],
  visited: ReadonlySet<string> | readonly string[] | undefined,
): boolean {
  if (categoryKeys.length === 0) return true
  const visitedSet = toVisitedCategorySet(visited)
  return categoryKeys.every((key) => visitedSet.has(key))
}

export function countUnvisitedAdditionalCategories(
  categoryKeys: readonly string[],
  visited: ReadonlySet<string> | readonly string[] | undefined,
): number {
  const visitedSet = toVisitedCategorySet(visited)
  return categoryKeys.filter((key) => !visitedSet.has(key)).length
}

export function markAdditionalCategoryVisitedInSet(
  visited: ReadonlySet<string>,
  categoryKey: string,
): Set<string> {
  if (!categoryKey || visited.has(categoryKey)) {
    return visited instanceof Set ? new Set(visited) : new Set(visited)
  }
  const next = new Set(visited)
  next.add(categoryKey)
  return next
}

/** Remove chaves obsoletas quando a lista visível muda. */
export function pruneVisitedAdditionalCategories(
  visited: ReadonlySet<string>,
  validKeys: readonly string[],
): Set<string> {
  const valid = new Set(validKeys)
  const next = new Set<string>()
  for (const key of visited) {
    if (valid.has(key)) next.add(key)
  }
  return next
}

export function getUnvisitedAdditionalCategoryKeys(
  categoryKeys: readonly string[],
  visited: ReadonlySet<string> | readonly string[] | undefined,
): string[] {
  const visitedSet = toVisitedCategorySet(visited)
  return categoryKeys.filter((key) => !visitedSet.has(key))
}

export function countVisitedAdditionalCategories(
  categoryKeys: readonly string[],
  visited: ReadonlySet<string> | readonly string[] | undefined,
): number {
  const visitedSet = toVisitedCategorySet(visited)
  return categoryKeys.filter((key) => visitedSet.has(key)).length
}

export type AdditionalCategoryReviewProgress = {
  total: number
  visited: number
  remaining: number
}

export function getAdditionalCategoryReviewProgress(
  categoryKeys: readonly string[],
  visited: ReadonlySet<string> | readonly string[] | undefined,
): AdditionalCategoryReviewProgress {
  const total = categoryKeys.length
  const visitedCount = countVisitedAdditionalCategories(categoryKeys, visited)
  return {
    total,
    visited: visitedCount,
    remaining: Math.max(0, total - visitedCount),
  }
}

function formatCategoryKeyForDisplay(categoryKey: string): string {
  const normalized = categoryKey.trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Quando labels traduzidos colidem, usa category_key legível como sufixo real. */
export function buildAdditionalCategoryDisplayLabels(
  groups: ReadonlyArray<{ categoryKey: string; categoryLabel: string }>,
): Map<string, string> {
  const labelCounts = new Map<string, number>()
  for (const group of groups) {
    labelCounts.set(
      group.categoryLabel,
      (labelCounts.get(group.categoryLabel) ?? 0) + 1,
    )
  }

  const labels = new Map<string, string>()
  for (const group of groups) {
    if ((labelCounts.get(group.categoryLabel) ?? 0) <= 1) {
      labels.set(group.categoryKey, group.categoryLabel)
      continue
    }

    const keyLabel = formatCategoryKeyForDisplay(group.categoryKey)
    const base = group.categoryLabel.trim()
    if (
      keyLabel &&
      keyLabel.localeCompare(base, undefined, { sensitivity: 'accent' }) !== 0
    ) {
      labels.set(group.categoryKey, `${base} — ${keyLabel}`)
    } else {
      labels.set(group.categoryKey, base)
    }
  }

  return labels
}
