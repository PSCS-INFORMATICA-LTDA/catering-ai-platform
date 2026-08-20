/**
 * Teste (offline, sem DB) — filtros/ordenação/paginação da lista de cotações
 *
 * Espelha (sem import TS, sem resolver alias `@/`) a lógica pura de:
 *   - Lib/quotes/statusMachine.ts (normalizeQuoteStatus)
 *   - Lib/quotes/listFilters.ts (applyQuoteListFilters)
 *
 * Não requer Supabase nem servidor rodando — apenas valida o comportamento
 * da função de filtragem em memória usada por GET /api/quotes.
 *
 * Uso:
 *   node scripts/dev/test-quotes-list-filters.mjs
 */

const LEGACY_ALIASES = { approved: 'accepted', canceled: 'cancelled' }
const CANONICAL_STATUSES = [
  'draft', 'ready_for_review', 'sent', 'viewed', 'accepted',
  'converted', 'rejected', 'expired', 'cancelled', 'archived',
]

function normalizeQuoteStatus(status) {
  const raw = (status ?? '').trim().toLowerCase()
  if (!raw) return 'draft'
  if (LEGACY_ALIASES[raw]) return LEGACY_ALIASES[raw]
  if (CANONICAL_STATUSES.includes(raw)) return raw
  return 'draft'
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const SORTABLE_FIELDS = new Set(['created_at', 'event_date', 'quote_total', 'quote_number'])

function matchesSearch(item, q) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const haystacks = [item.quote_number, item.customer_name, item.city, item.state, item.package_name]
  return haystacks.some((value) => (value ?? '').toLowerCase().includes(needle))
}

function parseSort(sort) {
  if (!sort) return { field: 'created_at', direction: 'desc' }
  const [fieldRaw, directionRaw] = sort.split(':')
  const field = SORTABLE_FIELDS.has(fieldRaw) ? fieldRaw : 'created_at'
  const direction = directionRaw === 'asc' ? 'asc' : 'desc'
  return { field, direction }
}

function compareByField(a, b, field, direction) {
  const factor = direction === 'asc' ? 1 : -1
  const av = a[field]
  const bv = b[field]
  if (av == null && bv == null) return 0
  if (av == null) return 1 * factor
  if (bv == null) return -1 * factor
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
  return String(av).localeCompare(String(bv)) * factor
}

function applyQuoteListFilters(items, filters) {
  let result = items

  if (filters.q?.trim()) {
    result = result.filter((item) => matchesSearch(item, filters.q))
  }
  if (filters.status?.trim()) {
    const targetStatus = normalizeQuoteStatus(filters.status)
    result = result.filter((item) => normalizeQuoteStatus(item.quote_status) === targetStatus)
  }
  if (filters.hasAcceptance) {
    result = result.filter((item) => (item.proposal_response ?? 'pending') === filters.hasAcceptance)
  }
  if (filters.hasOrder === 'yes') {
    result = result.filter((item) => Boolean(item.converted_service_order_id))
  } else if (filters.hasOrder === 'no') {
    result = result.filter((item) => !item.converted_service_order_id)
  }
  if (filters.dateFrom?.trim()) {
    result = result.filter((item) => (item.event_date ?? '') >= filters.dateFrom.trim())
  }
  if (filters.dateTo?.trim()) {
    result = result.filter((item) => (item.event_date ?? '') <= filters.dateTo.trim())
  }

  const { field, direction } = parseSort(filters.sort)
  result = [...result].sort((a, b) => compareByField(a, b, field, direction))

  const total = result.length
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))
  const page = Math.max(1, filters.page ?? 1)
  const start = (page - 1) * pageSize

  return { items: result.slice(start, start + pageSize), total, page, pageSize }
}

const FIXTURE = [
  { id: '1', quote_number: 'Q-0001', customer_name: 'Alice', city: 'Orlando', state: 'FL', package_name: 'Essencial', quote_status: 'draft', proposal_response: null, converted_service_order_id: null, event_date: '2026-01-10', quote_total: 1000, created_at: '2026-01-01T00:00:00Z' },
  { id: '2', quote_number: 'Q-0002', customer_name: 'Bob', city: 'Miami', state: 'FL', package_name: 'Premium', quote_status: 'sent', proposal_response: 'pending', converted_service_order_id: null, event_date: '2026-02-15', quote_total: 2000, created_at: '2026-01-02T00:00:00Z' },
  { id: '3', quote_number: 'Q-0003', customer_name: 'Carla', city: 'Tampa', state: 'FL', package_name: 'Essencial', quote_status: 'approved', proposal_response: 'accepted', converted_service_order_id: null, event_date: '2026-03-20', quote_total: 1500, created_at: '2026-01-03T00:00:00Z' },
  { id: '4', quote_number: 'Q-0004', customer_name: 'Dan', city: 'Orlando', state: 'FL', package_name: 'Premium', quote_status: 'converted', proposal_response: 'accepted', converted_service_order_id: 'os-1', event_date: '2026-04-05', quote_total: 2830, created_at: '2026-01-04T00:00:00Z' },
  { id: '5', quote_number: 'Q-0005', customer_name: 'Eve', city: 'Kissimmee', state: 'FL', package_name: 'Essencial', quote_status: 'rejected', proposal_response: 'rejected', converted_service_order_id: null, event_date: '2026-01-25', quote_total: 900, created_at: '2026-01-05T00:00:00Z' },
  { id: '6', quote_number: 'Q-0006', customer_name: 'Fabio', city: 'Winter Park', state: 'FL', package_name: 'Premium', quote_status: 'canceled', proposal_response: null, converted_service_order_id: null, event_date: '2026-05-30', quote_total: 500, created_at: '2026-01-06T00:00:00Z' },
]

let failures = 0
function check(label, condition, detail) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`)
  if (!condition) failures += 1
}

console.log('=== TEST QUOTES LIST FILTERS (offline) ===\n')

{
  const r = applyQuoteListFilters(FIXTURE, {})
  check('sem filtros retorna todos os itens', r.total === 6, `total=${r.total}`)
  check('ordenação padrão é created_at desc', r.items[0].id === '6' && r.items[5].id === '1')
}

{
  const r = applyQuoteListFilters(FIXTURE, { q: 'orlando' })
  check('busca por cidade "orlando" retorna 2', r.total === 2, `total=${r.total}`)
}

{
  const r = applyQuoteListFilters(FIXTURE, { q: 'Q-0003' })
  check('busca por número exato retorna 1', r.total === 1 && r.items[0].id === '3')
}

{
  const r = applyQuoteListFilters(FIXTURE, { status: 'accepted' })
  check(
    'filtro status="accepted" inclui alias legado "approved"',
    r.total === 1 && r.items[0].id === '3',
    `total=${r.total}`,
  )
}

{
  const r = applyQuoteListFilters(FIXTURE, { status: 'cancelled' })
  check(
    'filtro status="cancelled" inclui alias legado "canceled"',
    r.total === 1 && r.items[0].id === '6',
    `total=${r.total}`,
  )
}

{
  const r = applyQuoteListFilters(FIXTURE, { hasAcceptance: 'accepted' })
  check('filtro has_acceptance=accepted retorna 2', r.total === 2, `total=${r.total}`)
}

{
  const r = applyQuoteListFilters(FIXTURE, { hasAcceptance: 'pending' })
  check('filtro has_acceptance=pending inclui null como pending', r.total === 3, `total=${r.total}`)
}

{
  const r = applyQuoteListFilters(FIXTURE, { hasOrder: 'yes' })
  check('filtro has_order=yes retorna a cotação convertida', r.total === 1 && r.items[0].id === '4')
}

{
  const r = applyQuoteListFilters(FIXTURE, { hasOrder: 'no' })
  check('filtro has_order=no exclui a cotação convertida', r.total === 5 && !r.items.some((i) => i.id === '4'))
}

{
  const r = applyQuoteListFilters(FIXTURE, { dateFrom: '2026-02-01', dateTo: '2026-04-30' })
  check(
    'filtro por intervalo de datas retorna 3 (fev–abr)',
    r.total === 3 && r.items.every((i) => i.event_date >= '2026-02-01' && i.event_date <= '2026-04-30'),
    `total=${r.total}`,
  )
}

{
  const r = applyQuoteListFilters(FIXTURE, { sort: 'quote_total:asc' })
  check('ordenação por quote_total asc', r.items[0].id === '6' && r.items[5].id === '4')
}

{
  const r = applyQuoteListFilters(FIXTURE, { sort: 'quote_total:desc' })
  check('ordenação por quote_total desc', r.items[0].id === '4' && r.items[5].id === '6')
}

{
  const r1 = applyQuoteListFilters(FIXTURE, { page: 1, pageSize: 2 })
  const r2 = applyQuoteListFilters(FIXTURE, { page: 2, pageSize: 2 })
  check('paginação página 1 tem 2 itens', r1.items.length === 2)
  check('paginação página 2 tem 2 itens diferentes', r2.items.length === 2 && r2.items[0].id !== r1.items[0].id)
  check('paginação mantém total geral', r1.total === 6 && r2.total === 6)
}

console.log(`\n=== RESULTADO: ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ===`)
process.exit(failures === 0 ? 0 : 1)
