import { NextRequest, NextResponse } from 'next/server'
import {
  computeQuotePricing,
  parseQuotePricingPreviewBody,
  type QuotePricingPreviewBody,
} from '@/Lib/pricing/computeQuotePricing'
import { resolvePublicQuoteMileageDistance } from '@/Lib/publicQuote/distance'
import {
  hasConfirmedGoogleAddress,
  mergePublicQuotePreviewDraft,
} from '@/Lib/publicQuote/previewDraft'
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
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

const MILEAGE_ERROR_MESSAGE: Record<string, string> = {
  missing_origin:
    'Mileage origin is not configured for this company. The estimate cannot be completed.',
  missing_maps_key:
    'Distance lookup is not configured. The estimate cannot be completed.',
  lookup_failed:
    'We could not calculate the travel distance for this address. Please try again.',
}

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
    const draft = mergePublicQuotePreviewDraft(session.draft, body)
    const rules = await fetchSupabaseCommercialRules(session.company_id)
    const mileage = await resolvePublicQuoteMileageDistance(
      draft,
      rules.mileageBaseLocation,
      { referer: request.headers.get('origin') || request.nextUrl.origin },
    )

    if (hasConfirmedGoogleAddress(draft) && mileage.status !== 'resolved') {
      const code = mileage.reason || 'lookup_failed'
      if (code !== 'missing_destination') {
        return NextResponse.json(
          {
            error:
              MILEAGE_ERROR_MESSAGE[code] || MILEAGE_ERROR_MESSAGE.lookup_failed,
            code,
            field: 'mileage',
          },
          { status: 422, headers: NO_STORE },
        )
      }
    }

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
