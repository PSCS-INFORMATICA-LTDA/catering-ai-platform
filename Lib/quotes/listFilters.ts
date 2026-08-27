import type { QuoteListItem } from '@/Lib/fetchQuoteList'
import { normalizeQuoteStatus } from '@/Lib/quotes/statusMachine'

export type QuoteAcceptanceFilter = 'pending' | 'accepted' | 'rejected'
export type QuoteHasOrderFilter = 'yes' | 'no'

export type QuoteListFilters = {
  q?: string | null
  status?: string | null
  hasAcceptance?: QuoteAcceptanceFilter | null
  hasOrder?: QuoteHasOrderFilter | null
  dateFrom?: string | null
  dateTo?: string | null
  page?: number
  pageSize?: number
  sort?: string | null
}

export type QuoteListFilterResult = {
  items: QuoteListItem[]
  total: number
  page: number
  pageSize: number
}

export const DEFAULT_QUOTE_LIST_PAGE_SIZE = 25
export const MAX_QUOTE_LIST_PAGE_SIZE = 30
const DEFAULT_PAGE_SIZE = DEFAULT_QUOTE_LIST_PAGE_SIZE
const MAX_PAGE_SIZE = MAX_QUOTE_LIST_PAGE_SIZE

const SORTABLE_FIELDS = new Set([
  'created_at',
  'event_date',
  'quote_total',
  'quote_number',
])

export function parseQuoteListFiltersFromSearchParams(
  searchParams: URLSearchParams,
): QuoteListFilters {
  const acceptanceRaw = searchParams.get('has_acceptance')?.trim().toLowerCase()
  const hasOrderRaw = searchParams.get('has_order')?.trim().toLowerCase()

  return {
    q: searchParams.get('q'),
    status: searchParams.get('status'),
    hasAcceptance:
      acceptanceRaw === 'pending' || acceptanceRaw === 'accepted' || acceptanceRaw === 'rejected'
        ? acceptanceRaw
        : null,
    hasOrder: hasOrderRaw === 'yes' || hasOrderRaw === 'no' ? hasOrderRaw : null,
    dateFrom: searchParams.get('date_from'),
    dateTo: searchParams.get('date_to'),
    page: Number(searchParams.get('page')) || 1,
    pageSize: Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE,
    sort: searchParams.get('sort'),
  }
}

function matchesSearch(item: QuoteListItem, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const haystacks = [
    item.quote_number,
    item.customer_name,
    item.city,
    item.state,
    item.package_name,
  ]
  return haystacks.some((value) => (value ?? '').toLowerCase().includes(needle))
}

function parseSort(sort: string | null | undefined): { field: string; direction: 'asc' | 'desc' } {
  if (!sort) return { field: 'created_at', direction: 'desc' }
  const [fieldRaw, directionRaw] = sort.split(':')
  const field = SORTABLE_FIELDS.has(fieldRaw) ? fieldRaw : 'created_at'
  const direction = directionRaw === 'asc' ? 'asc' : 'desc'
  return { field, direction }
}

function compareByField(
  a: QuoteListItem,
  b: QuoteListItem,
  field: string,
  direction: 'asc' | 'desc',
): number {
  const factor = direction === 'asc' ? 1 : -1
  const av = (a as unknown as Record<string, unknown>)[field]
  const bv = (b as unknown as Record<string, unknown>)[field]

  if (av == null && bv == null) return 0
  if (av == null) return 1 * factor
  if (bv == null) return -1 * factor

  if (typeof av === 'number' && typeof bv === 'number') {
    return (av - bv) * factor
  }

  return String(av).localeCompare(String(bv)) * factor
}

/**
 * Aplica filtros/ordenação/paginação em memória sobre a lista já enriquecida
 * de cotações (Gate 1 — spec `quotes-orders-test-plan.md`).
 */
export function applyQuoteListFilters(
  items: QuoteListItem[],
  filters: QuoteListFilters,
): QuoteListFilterResult {
  let result = items

  if (filters.q?.trim()) {
    result = result.filter((item) => matchesSearch(item, filters.q as string))
  }

  if (filters.status?.trim()) {
    const targetStatus = normalizeQuoteStatus(filters.status)
    result = result.filter(
      (item) => normalizeQuoteStatus(item.quote_status) === targetStatus,
    )
  }

  if (filters.hasAcceptance) {
    result = result.filter(
      (item) => (item.proposal_response ?? 'pending') === filters.hasAcceptance,
    )
  }

  if (filters.hasOrder === 'yes') {
    result = result.filter((item) => Boolean(item.converted_service_order_id))
  } else if (filters.hasOrder === 'no') {
    result = result.filter((item) => !item.converted_service_order_id)
  }

  if (filters.dateFrom?.trim()) {
    result = result.filter((item) => (item.event_date ?? '') >= filters.dateFrom!.trim())
  }
  if (filters.dateTo?.trim()) {
    result = result.filter((item) => (item.event_date ?? '') <= filters.dateTo!.trim())
  }

  const { field, direction } = parseSort(filters.sort)
  result = [...result].sort((a, b) => compareByField(a, b, field, direction))

  const total = result.length
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
  )
  const page = Math.max(1, filters.page ?? 1)
  const start = (page - 1) * pageSize

  return {
    items: result.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  }
}
