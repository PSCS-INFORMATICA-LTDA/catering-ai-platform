import { fetchActiveCustomers } from '../../../Lib/fetchCustomers'
import { fetchCatalogItems } from '../../../Lib/fetchCatalogItems'
import { fetchPackages } from '../../../Lib/fetchPackages'
import { loadPackageConfiguration } from '../../../Lib/packageConfiguration'
import {
  createInitialWizardState,
  type WizardState,
} from '../../../Lib/quoteWizardTypes'
import { fetchSupabaseCommercialRules } from '../../../Lib/supabaseCommercialRules'
import QuoteWizard, {
  type CatalogItem,
  type Customer,
  type Package,
} from './QuoteWizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseNonNegInt(raw: string | undefined, fallback = 0): number {
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

function buildPrefillState(
  commercialRules: Awaited<ReturnType<typeof fetchSupabaseCommercialRules>>,
  sp: Record<string, string | string[] | undefined>,
): { state: WizardState; step: number } {
  const get = (key: string) => {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }

  const base = createInitialWizardState(commercialRules)
  const eventDate = (get('event_date') || '').trim()
  const startTime = (get('start_time') || '').trim().slice(0, 5)
  const endTime = (get('end_time') || '').trim().slice(0, 5)
  const eventName = (get('event_name') || '').trim()
  const fromAgenda = (get('from') || '') === 'agenda'

  const state: WizardState = {
    ...base,
    eventDate: eventDate || base.eventDate,
    startTime: startTime || base.startTime,
    endTime: endTime || base.endTime,
    eventName: eventName || base.eventName,
    adultCount: parseNonNegInt(get('adults'), base.adultCount),
    childrenUnder3Count: parseNonNegInt(
      get('children_under_3'),
      base.childrenUnder3Count,
    ),
    children4To12Count: parseNonNegInt(
      get('children_4_to_12'),
      base.children4To12Count,
    ),
  }

  // Agenda → cotação: começa no cliente; data/horário já vêm preenchidos no passo Evento.
  const step = fromAgenda || eventDate ? 0 : 0
  return { state, step }
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
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
  const { state: initialState, step: initialStep } = buildPrefillState(
    commercialRules,
    sp,
  )

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
      initialState={initialState}
      initialStep={initialStep}
    />
  )
}
