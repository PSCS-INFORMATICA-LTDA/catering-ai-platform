import {
  loadFrozenQuoteDetailForProposal,
  loadPublicProposalByToken,
} from '@/Lib/commercialReview/loadPublicProposal'
import {
  generateQuotePdfBuffer,
  getQuotePdfResponseHeaders,
} from '@/Lib/generateQuotePdf'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const loaded = await loadPublicProposalByToken(token)
  if (!loaded.ok) {
    return Response.json(loaded.payload, { status: loaded.status === 200 ? 404 : loaded.status })
  }
  if (!loaded.sharedVersionId) {
    return Response.json(
      {
        error: 'legacy_proposal_has_no_shared_version',
        message:
          'Propostas históricas sem pin usam a página pública. PDF congelado exige proposal_shared_version_id.',
      },
      { status: 409 },
    )
  }

  const frozen = await loadFrozenQuoteDetailForProposal({
    quoteId: loaded.quoteId,
    companyId: loaded.companyId,
    sharedVersionId: loaded.sharedVersionId,
  })
  if (!frozen.ok) {
    return Response.json(
      { error: frozen.code, message: frozen.error },
      { status: 409 },
    )
  }

  try {
    const buffer = await generateQuotePdfBuffer(frozen.quote)
    const headers = getQuotePdfResponseHeaders(frozen.quote)
    return new Response(new Uint8Array(buffer), { headers })
  } catch (pdfError) {
    console.error('Public proposal PDF generation failed:', pdfError)
    return Response.json({ error: 'pdf_generation_failed' }, { status: 500 })
  }
}
