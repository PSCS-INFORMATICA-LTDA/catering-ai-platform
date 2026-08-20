import { requireApiPermission } from '@/Lib/auth/requireApi'
import {
  computeQuotePricing,
  parseQuotePricingPreviewBody,
} from '@/Lib/pricing/computeQuotePricing'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  let body: Parameters<typeof parseQuotePricingPreviewBody>[0]
  try {
    body = (await request.json()) as Parameters<
      typeof parseQuotePricingPreviewBody
    >[0]
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = parseQuotePricingPreviewBody(body)
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  const result = await computeQuotePricing(parsed)
  if (!result.ok) {
    return Response.json(
      {
        error: result.error.message,
        code: result.error.code,
        field: result.error.field ?? null,
      },
      { status: 422 },
    )
  }

  return Response.json(
    {
      breakdown: result.breakdown,
      totals: result.totals,
      packagePricePerPerson: result.packagePricePerPerson,
      resolvedAdditionals: result.resolvedAdditionals,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
