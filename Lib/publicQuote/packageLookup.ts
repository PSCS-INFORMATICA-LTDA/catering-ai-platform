export type PackageLookupFields = {
  id: string
  package_key?: string | null
}

export function findPackageByIdOrKey<T extends PackageLookupFields>(
  packages: readonly T[],
  packageId: string | null | undefined,
): T | null {
  const needle = packageId?.trim()
  if (!needle) return null
  return (
    packages.find((pkg) => pkg.id === needle) ??
    packages.find((pkg) => pkg.package_key?.trim() === needle) ??
    null
  )
}

export function resolvePackageIdForPersistence<T extends PackageLookupFields>(
  packages: readonly T[],
  packageId: string | null | undefined,
): string | null {
  const found = findPackageByIdOrKey(packages, packageId)
  return found?.id ?? (packageId?.trim() || null)
}
