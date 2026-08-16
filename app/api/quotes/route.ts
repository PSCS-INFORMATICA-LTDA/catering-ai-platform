import { rejectSpoofedCompanyId, requireApiPermission } from '@/Lib/auth/requireApi'
import { createQuote } from '@/Lib/createQuote'
import type { QuoteSaveInput } from '@/Lib/buildQuoteSavePayload'
import { fetchQuoteList } from '@/Lib/fetchQuoteList'
import {
  applyQuoteListFilters,
  parseQuoteListFiltersFromSearchParams,
} from '@/Lib/quotes/listFilters'
import { logSaveQuoteError } from '@/Lib/supabaseSaveError'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  const { data, error } = await fetchQuoteList()

  if (error) {
    return Response.json(
      { error: error.message },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  }

  const url = new URL(request.url)
  const hasFilterParams = [
    'q',
    'status',
    'has_acceptance',
    'has_order',
    'date_from',
    'date_to',
    'page',
    'pageSize',
    'sort',
  ].some((key) => url.searchParams.has(key))

  if (!hasFilterParams) {
    return Response.json(
      { data: data ?? [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }

  const filters = parseQuoteListFiltersFromSearchParams(url.searchParams)
  const { items, total, page, pageSize } = applyQuoteListFilters(data ?? [], filters)

  return Response.json(
    { data: items, total, page, pageSize },
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
