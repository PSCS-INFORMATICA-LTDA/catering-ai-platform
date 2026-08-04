import { requireApiPermission } from '@/Lib/auth/requireApi'
import { fetchQuoteDetail } from '@/Lib/fetchQuoteDetail'
import {
  generateQuotePdfBuffer,
  getQuotePdfResponseHeaders,
} from '@/Lib/generateQuotePdf'
import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  const { id } = await params

  const { data, error } = await fetchQuoteDetail(id)

  if (error || !data) {
    return Response.json(
      {
        error: 'quote_not_found',
        message: 'Cotação não encontrada.',
        detail: error?.message ?? null,
      },
      { status: 404 },
    )
  }

  try {
    const buffer = await generateQuotePdfBuffer(data as QuoteDetail)
    const headers = getQuotePdfResponseHeaders(data as QuoteDetail)

    return new Response(new Uint8Array(buffer), { headers })
  } catch (pdfError) {
    console.error('PDF generation failed:', pdfError)
    return Response.json({ error: 'pdf_generation_failed' }, { status: 500 })
  }
}
