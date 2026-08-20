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

/**
 * DEV/TEST/DEMO catalog SKUs. Matching is by stable item_key (and fixture
 * labels), never by commercial product names such as Picanha.
 */
export function isPublicCatalogFixtureItem(item: {
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  category_key?: string | null
}): boolean {
  const key = (item.item_key ?? '').trim().toUpperCase()
  if (
    key === 'TEST' ||
    key.startsWith('TEST-') ||
    key.startsWith('TEST_') ||
    key.startsWith('DEV_')
  ) {
    return true
  }

  const category = (item.category_key ?? '').trim().toLowerCase()
  if (category === 'qa_inventory' || category === 'qa_inventory_jde') {
    return true
  }

  const name = `${item.item_name ?? ''} ${item.label_pt ?? ''} ${item.label_en ?? ''}`
    .trim()
    .toUpperCase()
  if (
    name.includes('TEST-DEV') ||
    name.includes('TESTE DEV') ||
    name.startsWith('QA INV') ||
    name.startsWith('JDE QA') ||
    name.startsWith('QA JDE')
  ) {
    return true
  }

  return false
}
