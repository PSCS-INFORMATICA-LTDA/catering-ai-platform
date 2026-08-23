import type { QuoteSaveInput } from './buildQuoteSavePayload'
import {
  normalizeSaveQuoteError,
  type SaveQuoteErrorInfo,
} from './supabaseSaveError'

export type SaveQuoteViaApiResult = {
  data: { id: string; quote_number?: string | null } | null
  error: SaveQuoteErrorInfo | null
}

/**
 * Grava cotação pela API autenticada (cookie SSR).
 * Não usar createQuote/updateQuote no browser — o cliente Lib/supabase.ts
 * não carrega a sessão do login e o INSERT em events cai em RLS 42501.
 */
export async function saveQuoteViaApi(
  payload: QuoteSaveInput,
  options?: { quoteId?: string },
): Promise<SaveQuoteViaApiResult> {
  const quoteId = options?.quoteId?.trim()
  const url = quoteId ? `/api/quotes/${quoteId}` : '/api/quotes'
  const method = quoteId ? 'PATCH' : 'POST'

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = (await response.json().catch(() => null)) as {
    id?: string
    quote_number?: string | null
    error?: string
    code?: string | null
    details?: string | null
    hint?: string | null
    step?: SaveQuoteErrorInfo['step'] | null
  } | null

  if (!response.ok || !body?.id) {
    return {
      data: null,
      error: normalizeSaveQuoteError(
        {
          step: body?.step ?? 'quote',
          message: body?.error ?? 'Could not save the quote.',
          code: body?.code ?? String(response.status),
          details: body?.details ?? null,
          hint: body?.hint ?? null,
          rawError: JSON.stringify(body),
        },
        body?.step ?? 'quote',
      ),
    }
  }

  return {
    data: { id: body.id, quote_number: body.quote_number ?? null },
    error: null,
  }
}
