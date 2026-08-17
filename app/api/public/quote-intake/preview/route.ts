import { NextRequest, NextResponse } from 'next/server'
import {
  computeQuotePricing,
  parseQuotePricingPreviewBody,
  type QuotePricingPreviewBody,
} from '@/Lib/pricing/computeQuotePricing'
import { resolvePublicQuoteMileageDistance } from '@/Lib/publicQuote/distance'
import {
  assertRequestOrigin,
  PublicQuoteHttpError,
  publicErrorResponse,
  readLimitedJson,
} from '@/Lib/publicQuote/security'
import {
  consumePublicQuoteRateLimit,
  loadPublicQuoteSession,
  loadPublicQuoteSessionTenant,
} from '@/Lib/publicQuote/session'
import { sanitizePublicQuoteDraft } from '@/Lib/publicQuote/validation'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

export async function POST(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const body = await readLimitedJson<QuotePricingPreviewBody>(request)
    if (!body || typeof body !== 'object') {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }
    const session = await loadPublicQuoteSession(request)
    await loadPublicQuoteSessionTenant(session)
    await consumePublicQuoteRateLimit(
      request,
      session.company_id,
      'preview',
      120,
      60 * 60,
    )

    const parsed = parseQuotePricingPreviewBody(body)
    if ('error' in parsed) {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }
    const draft = sanitizePublicQuoteDraft(session.draft)
    const rules = await fetchSupabaseCommercialRules(session.company_id)
    const mileage = await resolvePublicQuoteMileageDistance(
      draft,
      rules.mileageBaseLocation,
    )
    const result = await computeQuotePricing({
      ...parsed,
      companyId: session.company_id,
      language: session.locale,
      mileageDistance: mileage.distance,
      reservationPercentage: null,
      reservationAmountOverride: null,
      useCustomReservation: false,
      discountAmount: 0,
      requireSupabaseRules: true,
    })
    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Request could not be processed.',
          code: result.error.code,
          field: result.error.field ?? null,
        },
        { status: 422, headers: NO_STORE },
      )
    }
    return NextResponse.json(
      {
        breakdown: result.breakdown,
        totals: result.totals,
        packagePricePerPerson: result.packagePricePerPerson,
        resolvedAdditionals: result.resolvedAdditionals,
        mileage,
      },
      { headers: NO_STORE },
    )
  } catch (error) {
    const result = publicErrorResponse(error)
    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE,
    })
  }
}
