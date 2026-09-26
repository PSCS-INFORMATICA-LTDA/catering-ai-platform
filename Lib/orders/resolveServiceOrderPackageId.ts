/** Package used to decide whether an OS has included garnishes. */
export function resolveServiceOrderPackageId(input: {
  snapshotPackageId?: string | null
  selectionPackageId?: string | null
  quotePackageId?: string | null
}): string | null {
  return (
    input.snapshotPackageId?.trim() ||
    input.selectionPackageId?.trim() ||
    input.quotePackageId?.trim() ||
    null
  )
}
