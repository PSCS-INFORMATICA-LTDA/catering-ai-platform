import { pickLocalizedText } from './i18n/locales'
import {
  buildCustomersSelect,
  type CustomersNameSourceColumn,
} from './customersTableSchema'
import {
  CUSTOMER_DISPLAY_NAME_EMPTY,
  getCustomerDisplayName,
  type CustomerNameSource,
} from './getCustomerDisplayName'
import {
  decodeQuoteListCursor,
  encodeQuoteListCursor,
  quoteListCursorOrFilter,
  type QuoteListCursor,
} from './quotes/listCursor'
import { normalizeQuoteStatus } from './quotes/statusMachine'
import { getSupabaseServerClient } from './supabaseServer'

export const QUOTE_LIST_PAGE_SIZE = 25
export const QUOTE_LIST_MAX_PAGE_SIZE = 30

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
  package_label_en?: string | null
  package_label_es?: string | null
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

export type QuoteListQuery = {
  companyId: string
  q?: string | null
  status?: string | null
  hasAcceptance?: 'pending' | 'accepted' | 'rejected' | null
  hasOrder?: 'yes' | 'no' | null
  cursor?: QuoteListCursor | string | null
  limit?: number
}

export type QuoteListPage = {
  data: QuoteListItem[]
  error: { message: string } | null
  hasMore: boolean
  nextCursor: QuoteListCursor | null
  nextCursorToken: string | null
}

type CustomerRow = { id: string } & Pick<
  CustomerNameSource,
  CustomersNameSourceColumn
>

type EventRow = {
  event_date?: string | null
  city?: string | null
  state?: string | null
}

type PackageRow = {
  package_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
}

type QuoteListRow = {
  id: string
  company_id?: string
  quote_number: string | null
  quote_total: number | null
  quote_status: string | null
  created_at: string
  reservation_amount: number | null
  balance_due: number | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  additional_total: number | null
  mileage_fee: number | null
  mileage_distance: number | null
  proposal_response: string | null
  converted_service_order_id: string | null
  has_grill?: boolean | null
  grill_photo_required?: boolean | null
  grill_rental_required?: boolean | null
  customers?: CustomerRow | CustomerRow[] | null
  events?: EventRow | EventRow[] | null
  packages?: PackageRow | PackageRow[] | null
}

const QUOTE_LIST_COLUMNS = [
  'id',
  'company_id',
  'quote_number',
  'quote_total',
  'quote_status',
  'created_at',
  'reservation_amount',
  'balance_due',
  'physical_guest_count',
  'billable_guest_count',
  'additional_total',
  'mileage_fee',
  'mileage_distance',
  'proposal_response',
  'converted_service_order_id',
  'has_grill',
  'grill_photo_required',
  'grill_rental_required',
].join(', ')

const QUOTE_LIST_EMBED_SELECT = `${QUOTE_LIST_COLUMNS}, customers ( ${buildCustomersSelect()} ), events ( event_date, city, state ), packages ( package_name, label_pt, label_en, label_es )`

export function getQuoteListPackageName(
  quote: Pick<
    QuoteListItem,
    'package_name' | 'package_label_en' | 'package_label_es'
  >,
  locale?: string | null,
): string | null {
  return (
    pickLocalizedText(
      {
        pt: quote.package_name,
        en: quote.package_label_en,
        es: quote.package_label_es,
      },
      locale,
    ).trim() ||
    quote.package_name ||
    null
  )
}

export function sortQuoteListItems(items: QuoteListItem[]): QuoteListItem[] {
  return [...items].sort((left, right) => {
    const created = new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    if (created !== 0) return created
    return right.id.localeCompare(left.id)
  })
}

function one<T>(value: T | T[] | null | undefined): T | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function sanitizeIlike(raw: string): string {
  return raw.replace(/[%_,()"]/g, ' ').trim().slice(0, 80)
}

function clampPageSize(limit?: number): number {
  return Math.min(
    QUOTE_LIST_MAX_PAGE_SIZE,
    Math.max(1, limit ?? QUOTE_LIST_PAGE_SIZE),
  )
}

function mapQuoteListRow(row: QuoteListRow): QuoteListItem {
  const customer = one(row.customers)
  const event = one(row.events)
  const pkg = one(row.packages)
  return {
    id: row.id,
    quote_number: row.quote_number ?? '—',
    customer_name: customer
      ? getCustomerDisplayName(customer)
      : CUSTOMER_DISPLAY_NAME_EMPTY,
    quote_status: row.quote_status,
    event_date: event?.event_date ?? null,
    created_at: row.created_at,
    city: event?.city ?? null,
    state: event?.state ?? null,
    package_name:
      pkg?.package_name?.trim() || pkg?.label_pt?.trim() || null,
    package_label_en: pkg?.label_en?.trim() || null,
    package_label_es: pkg?.label_es?.trim() || null,
    quote_total: row.quote_total,
    reservation_amount: row.reservation_amount,
    balance_due: row.balance_due,
    physical_guest_count: row.physical_guest_count,
    billable_guest_count: row.billable_guest_count,
    has_additionals: Number(row.additional_total ?? 0) > 0,
    has_grill: row.has_grill ?? false,
    grill_photo_required: row.grill_photo_required ?? false,
    grill_rental_required: row.grill_rental_required ?? false,
    mileage_fee: row.mileage_fee,
    mileage_distance: row.mileage_distance,
    proposal_response: row.proposal_response ?? null,
    converted_service_order_id: row.converted_service_order_id ?? null,
  }
}

function applyServerFilters<T extends { or: Function; eq: Function; is: Function; not: Function }>(
  query: T,
  options: QuoteListQuery,
  allowCustomerSearch = true,
): T {
  let next = query
  const needle = options.q?.trim() ? sanitizeIlike(options.q) : ''
  if (needle) {
    next = (
      allowCustomerSearch
        ? next.or(
            `quote_number.ilike.%${needle}%,customers.ab_name.ilike.%${needle}%,customers.full_name.ilike.%${needle}%,customers.contact_name.ilike.%${needle}%`,
          )
        : next.or(`quote_number.ilike.%${needle}%`)
    ) as T
  }
  if (options.status?.trim() && options.status !== 'all') {
    const status = normalizeQuoteStatus(options.status)
    if (status === 'accepted') {
      next = next.or('quote_status.eq.accepted,quote_status.eq.approved') as T
    } else if (status === 'cancelled') {
      next = next.or('quote_status.eq.cancelled,quote_status.eq.canceled') as T
    } else {
      next = next.eq('quote_status', status) as T
    }
  }
  if (options.hasAcceptance === 'pending') {
    next = next.or('proposal_response.is.null,proposal_response.eq.pending') as T
  } else if (options.hasAcceptance === 'accepted' || options.hasAcceptance === 'rejected') {
    next = next.eq('proposal_response', options.hasAcceptance) as T
  }
  if (options.hasOrder === 'yes') {
    next = next.not('converted_service_order_id', 'is', null) as T
  } else if (options.hasOrder === 'no') {
    next = next.is('converted_service_order_id', null) as T
  }
  return next
}

function toCursor(value: QuoteListQuery['cursor']): QuoteListCursor | null {
  if (!value) return null
  if (typeof value === 'string') return decodeQuoteListCursor(value)
  return value
}

/**
 * Página de cotações ativas da empresa autorizada.
 * Um único HTTP PostgREST (quotes + embeds). Company filter obrigatório.
 */
export async function fetchQuoteList(
  options: QuoteListQuery,
): Promise<QuoteListPage> {
  const companyId = options.companyId?.trim()
  if (!companyId) {
    return {
      data: [],
      error: { message: 'company_context_required' },
      hasMore: false,
      nextCursor: null,
      nextCursorToken: null,
    }
  }

  const supabase = getSupabaseServerClient()
  const pageSize = clampPageSize(options.limit)
  const cursor = toCursor(options.cursor)

  const run = async (select: string, allowCustomerSearch: boolean) => {
    let query = supabase
      .from('quotes')
      .select(select)
      .eq('active', true)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1)

    query = applyServerFilters(query, options, allowCustomerSearch)
    if (cursor) {
      query = query.or(quoteListCursorOrFilter(cursor))
    }
    return query
  }

  let result = await run(QUOTE_LIST_EMBED_SELECT, true)
  if (result.error) {
    console.warn(
      '[CDL Quote] embed list query failed; retrying without embeds:',
      result.error.message,
    )
    result = await run(QUOTE_LIST_COLUMNS, false)
  }

  if (result.error) {
    return {
      data: null as unknown as QuoteListItem[],
      error: { message: result.error.message },
      hasMore: false,
      nextCursor: null,
      nextCursorToken: null,
    }
  }

  const rows = ((result.data ?? []) as unknown as QuoteListRow[]).filter(
    (row) => row.company_id === companyId,
  )
  const hasMore = rows.length > pageSize
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows
  const data = pageRows.map(mapQuoteListRow)
  const last = data[data.length - 1]
  const nextCursor =
    hasMore && last ? { created_at: last.created_at, id: last.id } : null

  return {
    data,
    error: null,
    hasMore,
    nextCursor,
    nextCursorToken: nextCursor ? encodeQuoteListCursor(nextCursor) : null,
  }
}
