import { fetchQuoteList, QUOTE_LIST_PAGE_SIZE } from '../../Lib/fetchQuoteList'
import QuotesDashboard from '../../components/QuotesDashboard'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { hasPermission } from '@/Lib/auth/permissions'
import { logDevServerTiming } from '@/Lib/observability/serverTiming'
import { parseQuoteListFiltersFromSearchParams } from '@/Lib/quotes/listFilters'
import { decodeQuoteListCursor } from '@/Lib/quotes/listCursor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const started = Date.now()
  const params = await searchParams
  const urlParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const scalar = firstParam(value)
    if (scalar) urlParams.set(key, scalar)
  }
  const filters = parseQuoteListFiltersFromSearchParams(urlParams)
  const cursor = decodeQuoteListCursor(firstParam(params.cursor))

  const session = await getAuthSession()
  const authMs = Date.now() - started
  const companyId = session ? resolveAuthorizedCompanyId(session) : ''

  const dbStarted = Date.now()
  const { data, error, hasMore, nextCursorToken } = await fetchQuoteList({
    companyId,
    q: filters.q,
    status: filters.status,
    hasAcceptance: filters.hasAcceptance,
    hasOrder: filters.hasOrder,
    cursor,
    limit: QUOTE_LIST_PAGE_SIZE,
  })
  logDevServerTiming('/quotes', {
    authMs,
    quoteDbMs: Date.now() - dbStarted,
    renderMs: Date.now() - started,
    pageSize: data?.length ?? 0,
    hasMore,
  })

  if (error) {
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  const canConvert = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'quotes.convert'),
  )

  return (
    <QuotesDashboard
      initialQuotes={data ?? []}
      canConvert={canConvert}
      hasMore={hasMore}
      nextCursor={nextCursorToken}
      initialFilters={{
        q: filters.q ?? '',
        status: filters.status ?? 'all',
        acceptance: filters.hasAcceptance ?? 'all',
        hasOrder: filters.hasOrder ?? 'all',
      }}
    />
  )
}
