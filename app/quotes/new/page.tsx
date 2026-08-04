import { fetchActiveCustomers } from '../../../Lib/fetchCustomers'
import { fetchCatalogItems } from '../../../Lib/fetchCatalogItems'
import { fetchPackages } from '../../../Lib/fetchPackages'
import { loadPackageConfiguration } from '../../../Lib/packageConfiguration'
import { fetchSupabaseCommercialRules } from '../../../Lib/supabaseCommercialRules'
import QuoteWizard, {
  type CatalogItem,
  type Customer,
  type Package,
} from './QuoteWizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NewQuotePage() {
  const fetchErrors: string[] = []

  const [customersRes, packagesRes, catalogRes, commercialRules] =
    await Promise.all([
      fetchActiveCustomers(),
      fetchPackages({ activeOnly: true }),
      fetchCatalogItems({
        activeOnly: true,
        usage: 'additional',
        audience: 'customer',
      }),
      fetchSupabaseCommercialRules(),
    ])

  const packages = (packagesRes.data ?? []) as unknown as Package[]
  const packageConfigurationRes = await loadPackageConfiguration({
    packageIds: packages.map((pkg) => pkg.id),
  })

  if (customersRes.error) {
    fetchErrors.push(`Clientes: ${customersRes.error.message}`)
  }
  if (packagesRes.error) {
    fetchErrors.push(`Pacotes: ${packagesRes.error.message}`)
  }
  if (catalogRes.error) {
    fetchErrors.push(`Catálogo de itens: ${catalogRes.error.message}`)
  }
  if (packageConfigurationRes.error) {
    fetchErrors.push(
      `Configuração do pacote: ${packageConfigurationRes.error.message}`,
    )
  }
  const optionQueryDebug = packageConfigurationRes.optionQueryDebug
  if (optionQueryDebug?.groupsError?.message) {
    fetchErrors.push(
      `package_option_groups: ${optionQueryDebug.groupsError.message}`,
    )
  }
  if (optionQueryDebug?.itemsError?.message) {
    fetchErrors.push(
      `package_option_group_items: ${optionQueryDebug.itemsError.message}`,
    )
  }
  if (!packagesRes.error && packages.length === 0) {
    fetchErrors.push('Pacotes: nenhum pacote ativo encontrado para a empresa.')
  }

  const packageConfiguration = packageConfigurationRes.data ?? {
    packageItems: [],
    packageSideItems: [],
    optionGroups: [],
    optionGroupItems: [],
  }

  const customers = (customersRes.data ?? []) as Customer[]
  const catalogItems = (catalogRes.data ?? []) as unknown as CatalogItem[]

  return (
    <QuoteWizard
      customers={customers}
      packages={packages}
      catalogItems={catalogItems}
      packageOptionGroups={packageConfiguration.optionGroups}
      packageOptionGroupItems={packageConfiguration.optionGroupItems}
      packageOptionQueryDebug={packageConfigurationRes.optionQueryDebug ?? null}
      packageItems={packageConfiguration.packageItems}
      packageSideItems={packageConfiguration.packageSideItems}
      commercialRules={commercialRules}
      fetchErrors={fetchErrors}
    />
  )
}
