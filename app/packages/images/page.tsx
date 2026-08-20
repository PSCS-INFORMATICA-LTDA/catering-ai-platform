import CatalogImagesDashboard from '@/components/CatalogImagesDashboard'
import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import type { CatalogItemListItem } from '@/Lib/fetchCatalogItems'
import { supabase } from '@/Lib/supabase'

export default async function CatalogImagesPage() {
  const [packagesRes, catalogRes] = await Promise.all([
    supabase
      .from('packages')
      .select('id, package_key, package_name, label_pt, image_url')
      .eq('active', true)
      .order('display_order', { ascending: true }),
    fetchCatalogItems({ activeOnly: true, audience: 'admin', withCurrentPrices: false }),
  ])

  const packagesError = packagesRes.error?.message ?? null
  const catalogError = catalogRes.error?.message ?? null

  return (
    <CatalogImagesDashboard
      packages={packagesRes.data ?? []}
      items={(catalogRes.data ?? []) as unknown as CatalogItemListItem[]}
      packagesError={packagesError}
      catalogError={catalogError}
    />
  )
}
