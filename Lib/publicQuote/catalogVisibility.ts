/**
 * Public catalog visibility helpers.
 * Test/demo rows stay in backoffice; they must not appear on the public quote.
 */
export function isPublicCatalogFixturePackage(pkg: {
  package_key?: string | null
  package_name?: string | null
  label_pt?: string | null
  label_en?: string | null
}): boolean {
  const key = (pkg.package_key ?? '').trim().toUpperCase()
  const name = `${pkg.package_name ?? ''} ${pkg.label_pt ?? ''} ${pkg.label_en ?? ''}`
    .trim()
    .toUpperCase()
  return (
    key.startsWith('TEST') ||
    key.includes('TEST-DEV') ||
    name.includes('TEST-DEV')
  )
}
