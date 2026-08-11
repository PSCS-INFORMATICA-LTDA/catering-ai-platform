import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import { buildCustomersListSelect } from '@/Lib/customersTableSchema'
import { buildPackagesListSelect } from '@/Lib/packagesTableSchema'
import type { QuoteAdditionalItem, QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import type { CatalogItem, Customer, Package } from '@/app/quotes/new/QuoteWizard'
import { enrichQuoteAdditionalsFromCatalog } from '@/Lib/catalogItemVisual'
import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import { loadPackageConfiguration } from './packageConfiguration'
import { fetchQuotePackageSelections } from './fetchPackageOptionGroups'
import { fetchQuoteDetail } from './fetchQuoteDetail'
import type { CommercialRulesSnapshot } from './supabaseCommercialRules'
import { fetchSupabaseCommercialRules } from './supabaseCommercialRules'
import { supabase } from './supabase'
import { tw } from './quoteTranslations'

type QuoteRow = {
  event_id?: string | null
  customer_id?: string | null
  package_id?: string | null
}

type EventRow = {
  event_name?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  adults_count?: number | null
  children_count?: number | null
  has_grill?: boolean | null
  grill_photo_required?: boolean | null
  grill_rental_required?: boolean | null
  grill_rental_qty?: number | null
  grill_notes?: string | null
  distance_from_base?: number | null
  grill_photo_url?: string | null
  grill_photo_media_id?: string | null
}

type QuoteAdditionalRow = {
  additional_item_id: string
  quantity?: number | null
  unit_price?: number | null
  total_price?: number | null
}

function mapQuoteAdditionalRows(
  rows: QuoteAdditionalRow[],
  catalogItems: CatalogItemListItem[] = [],
): QuoteAdditionalItem[] {
  const mapped = rows
    .filter((row) => row.additional_item_id && (row.quantity ?? 0) > 0)
    .map((row) => ({
      item_id: row.additional_item_id,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total_price: row.total_price,
    }))
  return enrichQuoteAdditionalsFromCatalog(
    mapped,
    catalogItems,
  ) as QuoteAdditionalItem[]
}

function mergeEventIntoQuote(quote: QuoteDetail, event: EventRow | null): QuoteDetail {
  if (!event) return quote

  return {
    ...quote,
    event_name: event.event_name ?? quote.event_name,
    event_date: event.event_date ?? quote.event_date,
    start_time: event.start_time ?? quote.start_time,
    end_time: event.end_time ?? quote.end_time,
    address_line: event.address_line ?? quote.address_line,
    city: event.city ?? quote.city,
    state: event.state ?? quote.state,
    postal_code: event.postal_code ?? quote.postal_code,
    zip_code: event.postal_code ?? quote.zip_code,
    has_grill: event.has_grill ?? quote.has_grill,
    grill_photo_required: event.grill_photo_required ?? quote.grill_photo_required,
    grill_rental_required: event.grill_rental_required ?? quote.grill_rental_required,
    grill_rental_qty: event.grill_rental_qty ?? quote.grill_rental_qty,
    grill_notes: event.grill_notes ?? quote.grill_notes,
    mileage_distance: event.distance_from_base ?? quote.mileage_distance,
    adult_count: event.adults_count ?? quote.adult_count,
    grill_photo_url: event.grill_photo_url ?? quote.grill_photo_url,
    grill_photo_media_id:
      event.grill_photo_media_id ?? quote.grill_photo_media_id,
  }
}

function mergePackages(
  activePackages: Package[],
  linkedPackage: Package | null,
): Package[] {
  if (!linkedPackage) return activePackages
  if (activePackages.some((pkg) => pkg.id === linkedPackage.id)) {
    return activePackages
  }
  return [...activePackages, linkedPackage]
}

export type FetchQuoteForEditResult = {
  quote: QuoteDetail | null
  linkedCustomer: Customer | null
  packages: Package[]
  catalogItems: CatalogItem[]
  packageOptionGroups: import('@/Lib/packageOptionGroups').PackageOptionGroupRecord[]
  packageOptionGroupItems: import('@/Lib/packageOptionGroups').PackageOptionGroupItem[]
  packageItems: import('@/Lib/packageConfiguration').PackageItem[]
  packageSideItems: import('@/Lib/packageConfiguration').PackageSideItem[]
  commercialRules: CommercialRulesSnapshot
  fetchErrors: string[]
  error: { message: string } | null
}

export async function fetchQuoteForEdit(
  quoteId: string,
  language: string | null | undefined = 'pt',
): Promise<FetchQuoteForEditResult> {
  const fetchErrors: string[] = []

  const [quoteRes, commercialRules] = await Promise.all([
    fetchQuoteDetail(quoteId),
    fetchSupabaseCommercialRules(),
  ])

  if (quoteRes.error || !quoteRes.data) {
    return {
      quote: null,
      linkedCustomer: null,
      packages: [],
      catalogItems: [],
      packageOptionGroups: [],
      packageOptionGroupItems: [],
      packageItems: [],
      packageSideItems: [],
      commercialRules,
      fetchErrors,
      error: quoteRes.error ?? { message: tw(language, 'quoteNotFound') },
    }
  }

  const { data: quoteRow, error: quoteRowError } = await supabase
    .from('quotes')
    .select('event_id, customer_id, package_id')
    .eq('id', quoteId)
    .eq('active', true)
    .maybeSingle()

  if (quoteRowError) {
    fetchErrors.push(`${tw(language, 'fetchErrorQuote')}: ${quoteRowError.message}`)
  }

  const row = (quoteRow ?? {}) as QuoteRow
  const eventId = row.event_id ?? null
  const customerId = row.customer_id ?? quoteRes.data.customer_id ?? null
  const packageId = row.package_id ?? quoteRes.data.package_id ?? null

  const [
    eventRes,
    customerRes,
    linkedPackageRes,
    quoteAdditionalsRes,
    quoteSelectionsRes,
    packageConfigurationRes,
    packagesRes,
    catalogRes,
  ] = await Promise.all([
    eventId
      ? supabase.from('events').select('*').eq('id', eventId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    customerId
      ? supabase
          .from('customers')
          .select(buildCustomersListSelect())
          .eq('id', customerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    packageId
      ? supabase
          .from('packages')
          .select(buildPackagesListSelect())
          .eq('id', packageId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('quote_additional_items')
      .select('additional_item_id, quantity, unit_price, total_price')
      .eq('quote_id', quoteId),
    fetchQuotePackageSelections(quoteId),
    loadPackageConfiguration(),
    supabase
      .from('packages')
      .select(buildPackagesListSelect())
      .eq('active', true)
      .order('display_order', { ascending: true }),
    fetchCatalogItems({
      activeOnly: true,
      usage: 'additional',
      audience: 'customer',
    }),
  ])

  if (eventRes.error) {
    fetchErrors.push(`${tw(language, 'fetchErrorEvent')}: ${eventRes.error.message}`)
  }
  if (customerRes.error) {
    fetchErrors.push(
      `${tw(language, 'fetchErrorCustomers')}: ${customerRes.error.message}`,
    )
  }
  if (linkedPackageRes.error) {
    fetchErrors.push(
      `${tw(language, 'fetchErrorLinkedPackage')}: ${linkedPackageRes.error.message}`,
    )
  }
  if (quoteAdditionalsRes.error) {
    fetchErrors.push(
      `${tw(language, 'fetchErrorQuoteAdditionals')}: ${quoteAdditionalsRes.error.message}`,
    )
  }
  if (quoteSelectionsRes.error) {
    fetchErrors.push(
      `${tw(language, 'fetchErrorPackageSelections')}: ${quoteSelectionsRes.error.message}`,
    )
  }
  if (packageConfigurationRes.error) {
    fetchErrors.push(
      `${tw(language, 'fetchErrorPackageConfig')}: ${packageConfigurationRes.error.message}`,
    )
  }

  const packageConfiguration = packageConfigurationRes.data ?? {
    packageItems: [],
    packageSideItems: [],
    optionGroups: [],
    optionGroupItems: [],
  }
  if (packagesRes.error) {
    fetchErrors.push(`${tw(language, 'fetchErrorPackages')}: ${packagesRes.error.message}`)
  }
  if (catalogRes.error) {
    fetchErrors.push(`${tw(language, 'fetchErrorCatalog')}: ${catalogRes.error.message}`)
  }

  const mappedAdditionals = mapQuoteAdditionalRows(
    (quoteAdditionalsRes.data ?? []) as QuoteAdditionalRow[],
    (catalogRes.data ?? []) as CatalogItemListItem[],
  )

  let quote = mergeEventIntoQuote(
    quoteRes.data,
    (eventRes.data as EventRow | null) ?? null,
  )

  if (mappedAdditionals.length > 0) {
    quote = { ...quote, additional_items: mappedAdditionals }
  }

  const packageSelections = quoteSelectionsRes.data ?? []
  if (packageSelections.length > 0) {
    quote = {
      ...quote,
      package_selections: packageSelections.map((row) => ({
        option_group_id: row.option_group_id,
        option_item_id: row.option_item_id,
        package_id: row.package_id,
      })),
    }
  }

  if (customerId && !quote.customer_id) {
    quote = { ...quote, customer_id: customerId }
  }

  if (packageId && !quote.package_id) {
    quote = { ...quote, package_id: packageId }
  }

  const linkedCustomer = (customerRes.data as Customer | null) ?? null
  const linkedPackage = (linkedPackageRes.data as unknown as Package | null) ?? null
  const packages = mergePackages(
    (packagesRes.data ?? []) as unknown as Package[],
    linkedPackage,
  )

  return {
    quote,
    linkedCustomer,
    packages,
    catalogItems: (catalogRes.data ?? []) as unknown as CatalogItem[],
    packageOptionGroups: packageConfiguration.optionGroups,
    packageOptionGroupItems: packageConfiguration.optionGroupItems,
    packageItems: packageConfiguration.packageItems,
    packageSideItems: packageConfiguration.packageSideItems,
    commercialRules,
    fetchErrors,
    error: null,
  }
}
