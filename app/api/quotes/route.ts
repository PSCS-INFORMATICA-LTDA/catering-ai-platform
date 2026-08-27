import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { createQuote } from '@/Lib/createQuote'
import type { QuoteSaveInput } from '@/Lib/buildQuoteSavePayload'
import {
  fetchQuoteList,
  QUOTE_LIST_MAX_PAGE_SIZE,
  QUOTE_LIST_PAGE_SIZE,
} from '@/Lib/fetchQuoteList'
import { parseQuoteListFiltersFromSearchParams } from '@/Lib/quotes/listFilters'
import { decodeQuoteListCursor } from '@/Lib/quotes/listCursor'
import { logSaveQuoteError } from '@/Lib/supabaseSaveError'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const filters = parseQuoteListFiltersFromSearchParams(url.searchParams)
  const requestedSize = Number(url.searchParams.get('pageSize') || filters.pageSize || QUOTE_LIST_PAGE_SIZE)
  const limit = Math.min(
    QUOTE_LIST_MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(requestedSize) ? requestedSize : QUOTE_LIST_PAGE_SIZE),
  )
  const { data, error, hasMore, nextCursorToken } = await fetchQuoteList({
    companyId: resolveAuthorizedCompanyId(auth.session),
    q: filters.q,
    status: filters.status,
    hasAcceptance: filters.hasAcceptance,
    hasOrder: filters.hasOrder,
    cursor: decodeQuoteListCursor(url.searchParams.get('cursor')),
    limit,
  })

  if (error) {
    return Response.json(
      { error: error.message },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  }

  return Response.json(
    {
      data: data ?? [],
      hasMore,
      nextCursor: nextCursorToken,
      pageSize: limit,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  let body: QuoteSaveInput & { company_id?: string }

  try {
    body = (await request.json()) as QuoteSaveInput & { company_id?: string }
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  if (!body.packageId) {
    return Response.json(
      { error: 'Pacote é obrigatório.' },
      { status: 400 },
    )
  }

  const { data, error } = await createQuote(body)

  if (error || !data?.id) {
    if (error) logSaveQuoteError(error)
    return Response.json(
      {
        error: error?.message ?? 'Erro ao gravar cotação no Supabase.',
        code: error?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
        step: error?.step ?? null,
      },
      { status: 500 },
    )
  }

  return Response.json({ id: data.id, quote_number: data.quote_number })
}
