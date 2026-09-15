import { requireApiPermission, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { loadFrozenQuoteDetailForProposal } from '@/Lib/commercialReview/loadPublicProposal'
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
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await fetchQuoteDetail(id, null, { companyId })

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

  let quote = data as QuoteDetail
  if (quote.proposal_shared_version_id) {
    const frozen = await loadFrozenQuoteDetailForProposal({
      quoteId: id,
      companyId,
      sharedVersionId: quote.proposal_shared_version_id,
    })
    if (!frozen.ok) {
      return Response.json(
        { error: frozen.code, message: frozen.error },
        { status: 409 },
      )
    }
    quote = frozen.quote
  }

  try {
    const buffer = await generateQuotePdfBuffer(quote)
    const headers = getQuotePdfResponseHeaders(quote)

    return new Response(new Uint8Array(buffer), { headers })
  } catch (pdfError) {
    console.error('PDF generation failed:', pdfError)
    return Response.json({ error: 'pdf_generation_failed' }, { status: 500 })
  }
}
