import { getCdlCompanyId } from './cdlCompany'
import {
  buildCustomersSelect,
  type CustomersNameSourceColumn,
} from './customersTableSchema'
import {
  CUSTOMER_DISPLAY_NAME_EMPTY,
  getCustomerDisplayName,
  type CustomerNameSource,
} from './getCustomerDisplayName'
import { getSupabaseServerClient } from './supabaseServer'

export type QuoteListGrillFields = {
  has_grill: boolean
  grill_photo_required: boolean
  grill_rental_required: boolean
}

export const QUOTE_LIST_GRILL_DEFAULTS: QuoteListGrillFields = {
  has_grill: false,
  grill_photo_required: false,
  grill_rental_required: false,
}

export type QuoteListItem = {
  id: string
  quote_number: string
  customer_name: string
  quote_status: string | null
  event_date: string | null
  created_at: string
  city: string | null
  state: string | null
  package_name: string | null
  quote_total: number | null
  reservation_amount: number | null
  balance_due: number | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  has_additionals: boolean
  has_grill: boolean
  grill_photo_required: boolean
  grill_rental_required: boolean
  mileage_fee: number | null
  mileage_distance: number | null
  proposal_response: string | null
  converted_service_order_id: string | null
}

type QuoteRow = {
  id: string
  quote_number: string | null
  quote_total: number | null
  quote_status: string | null
  created_at: string
  customer_id: string | null
  event_id: string | null
  package_id: string | null
  active: boolean | null
  reservation_amount: number | null
  balance_due: number | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  additional_total: number | null
  mileage_fee: number | null
  mileage_distance: number | null
  proposal_response: string | null
  converted_service_order_id: string | null
}

type ListViewRow = {
  id: string
  event_date?: string | null
  /** De `vw_customer_display` via quote_list_view */
  customer_display_name?: string | null
  /** Legado — views antigas com `ab_name AS customer_name` */
  customer_name?: string | null
  city?: string | null
  state?: string | null
  package_name?: string | null
}

type CustomerRow = { id: string } & Pick<
  CustomerNameSource,
  CustomersNameSourceColumn
>

type EventRow = {
  id: string
  event_date?: string | null
  city?: string | null
  state?: string | null
}

type PackageRow = {
  id: string
  package_name?: string | null
  label_pt?: string | null
}

type GrillViewRow = {
  id: string
  has_grill?: boolean | null
  grill_photo_required?: boolean | null
  grill_rental_required?: boolean | null
}

/** Colunas base de `quotes` — sem filtro por source ou quote_status. */
const QUOTE_LIST_SELECT =
  'id, quote_number, quote_total, quote_status, created_at, customer_id, event_id, package_id, active, reservation_amount, balance_due, physical_guest_count, billable_guest_count, additional_total, mileage_fee, mileage_distance, proposal_response, converted_service_order_id'

function resolveCustomerDisplayName(
  customer: CustomerRow | undefined,
  view: ListViewRow | undefined,
): string {
  const fromViewColumn =
    view?.customer_display_name?.trim() ||
    view?.customer_name?.trim() ||
    ''
  if (fromViewColumn) return fromViewColumn

  const fromCustomer = getCustomerDisplayName(customer)
  if (fromCustomer !== CUSTOMER_DISPLAY_NAME_EMPTY) return fromCustomer

  return CUSTOMER_DISPLAY_NAME_EMPTY
}

function resolvePackageName(
  viewName: string | null | undefined,
  packageRow: PackageRow | undefined,
): string | null {
  return (
    viewName?.trim() ||
    packageRow?.package_name?.trim() ||
    packageRow?.label_pt?.trim() ||
    null
  )
}

function resolveGrillFields(
  row: GrillViewRow | undefined,
): QuoteListGrillFields {
  if (!row) return QUOTE_LIST_GRILL_DEFAULTS

  return {
    has_grill: row.has_grill ?? false,
    grill_photo_required: row.grill_photo_required ?? false,
    grill_rental_required: row.grill_rental_required ?? false,
  }
}

async function fetchGrillFieldsByQuoteId(
  quoteIds: string[],
): Promise<Map<string, QuoteListGrillFields>> {
  if (quoteIds.length === 0) return new Map()

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('quote_detail_view')
    .select('id, has_grill, grill_photo_required, grill_rental_required')
    .in('id', quoteIds)

  if (error) {
    console.warn(
      '[CDL Quote] grill fields unavailable in quote_detail_view; using defaults:',
      error.message,
    )
    return new Map()
  }

  return new Map(
    ((data ?? []) as GrillViewRow[]).map((row) => [
      row.id,
      resolveGrillFields(row),
    ]),
  )
}

export function sortQuoteListItems(items: QuoteListItem[]): QuoteListItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

/**
 * Lista cotações ativas da tabela `quotes` (active = true).
 * Inclui draft, wizard e qualquer source — sem filtrar quote_status ou source.
 */
export async function fetchQuoteList() {
  const companyId = getCdlCompanyId()
  const supabase = getSupabaseServerClient()

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(QUOTE_LIST_SELECT)
    .eq('active', true)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null as QuoteListItem[] | null, error }
  }

  const rows = (quotes ?? []) as QuoteRow[]
  if (rows.length === 0) {
    return { data: [], error: null }
  }

  const quoteIds = rows.map((row) => row.id)
  const customerIds = [
    ...new Set(rows.map((row) => row.customer_id).filter(Boolean)),
  ] as string[]
  const eventIds = [
    ...new Set(rows.map((row) => row.event_id).filter(Boolean)),
  ] as string[]
  const packageIds = [
    ...new Set(rows.map((row) => row.package_id).filter(Boolean)),
  ] as string[]

  const [customersRes, listViewRes, eventsRes, packagesRes, grillMap] =
    await Promise.all([
      customerIds.length > 0
        ? supabase
            .from('customers')
            .select(buildCustomersSelect())
            .in('id', customerIds)
        : Promise.resolve({ data: [] as CustomerRow[], error: null }),
      supabase
        .from('quote_list_view')
        .select(
          'id, event_date, customer_display_name, customer_name, city, state, package_name',
        )
        .in('id', quoteIds),
      eventIds.length > 0
        ? supabase
            .from('events')
            .select('id, event_date, city, state')
            .in('id', eventIds)
        : Promise.resolve({ data: [] as EventRow[], error: null }),
      packageIds.length > 0
        ? supabase
            .from('packages')
            .select('id, package_name, label_pt')
            .in('id', packageIds)
        : Promise.resolve({ data: [] as PackageRow[], error: null }),
      fetchGrillFieldsByQuoteId(quoteIds),
    ])

  if (customersRes.error) {
    console.warn(
      '[CDL Quote] customers enrichment failed; using fallbacks:',
      customersRes.error.message,
    )
  }

  let listViewRows = (listViewRes.data ?? []) as ListViewRow[]
  if (listViewRes.error) {
    console.warn(
      '[CDL Quote] quote_list_view enrichment failed:',
      listViewRes.error.message,
    )
    const { data: detailRows } = await supabase
      .from('quote_detail_view')
      .select('id, event_date, customer_name, city, state, package_name_pt')
      .in('id', quoteIds)
    listViewRows = (detailRows ?? []).map((row) => ({
      id: row.id as string,
      event_date: row.event_date as string | null,
      customer_name: row.customer_name as string | null,
      city: row.city as string | null,
      state: row.state as string | null,
      package_name: row.package_name_pt as string | null,
    }))
  }

  if (eventsRes.error) {
    console.warn(
      '[CDL Quote] events enrichment failed:',
      eventsRes.error.message,
    )
  }

  if (packagesRes.error) {
    console.warn(
      '[CDL Quote] packages enrichment failed:',
      packagesRes.error.message,
    )
  }

  const customerMap = new Map(
    ((customersRes.data ?? []) as CustomerRow[]).map((customer) => [
      customer.id,
      customer,
    ]),
  )
  const listViewMap = new Map(listViewRows.map((row) => [row.id, row]))
  const eventMap = new Map(
    ((eventsRes.data ?? []) as EventRow[]).map((row) => [row.id, row]),
  )
  const packageMap = new Map(
    ((packagesRes.data ?? []) as PackageRow[]).map((row) => [row.id, row]),
  )

  const data = rows.map((row) => {
    const view = listViewMap.get(row.id)
    const event = row.event_id ? eventMap.get(row.event_id) : undefined
    const pkg = row.package_id ? packageMap.get(row.package_id) : undefined
    const customer = row.customer_id
      ? customerMap.get(row.customer_id)
      : undefined
    const grill = grillMap.get(row.id) ?? QUOTE_LIST_GRILL_DEFAULTS

    return {
      id: row.id,
      quote_number: row.quote_number ?? '—',
      customer_name: resolveCustomerDisplayName(customer, view),
      quote_status: row.quote_status,
      event_date: view?.event_date ?? event?.event_date ?? null,
      created_at: row.created_at,
      city: view?.city ?? event?.city ?? null,
      state: view?.state ?? event?.state ?? null,
      package_name: resolvePackageName(view?.package_name, pkg),
      quote_total: row.quote_total,
      reservation_amount: row.reservation_amount,
      balance_due: row.balance_due,
      physical_guest_count: row.physical_guest_count,
      billable_guest_count: row.billable_guest_count,
      has_additionals: Number(row.additional_total ?? 0) > 0,
      has_grill: grill.has_grill,
      grill_photo_required: grill.grill_photo_required,
      grill_rental_required: grill.grill_rental_required,
      mileage_fee: row.mileage_fee,
      mileage_distance: row.mileage_distance,
      proposal_response: row.proposal_response ?? null,
      converted_service_order_id: row.converted_service_order_id ?? null,
    } satisfies QuoteListItem
  })

  return { data: sortQuoteListItems(data), error: null }
}
