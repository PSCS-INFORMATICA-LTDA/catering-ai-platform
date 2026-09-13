import { NextRequest, NextResponse } from 'next/server'
import {
  computeQuotePricing,
  parseQuotePricingPreviewBody,
  type QuotePricingPreviewBody,
} from '@/Lib/pricing/computeQuotePricing'
import { resolveCouponForPricing } from '@/Lib/coupons/resolveCoupon'
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
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

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

    const pricingArgs = {
      ...parsed,
      companyId: session.company_id,
      language: session.locale,
      mileageDistance: mileage.distance,
      reservationPercentage: null,
      reservationAmountOverride: null,
      useCustomReservation: false,
      requireSupabaseRules: true,
    } as const
    const base = await computeQuotePricing({ ...pricingArgs, discountAmount: 0 })
    if (!base.ok) {
      return NextResponse.json(
        {
          error: 'Request could not be processed.',
          code: base.error.code,
          field: base.error.field ?? null,
        },
        { status: 422, headers: NO_STORE },
      )
    }

    const db = getSupabaseServerClient()
    const { data: sessionRow, error: sessionError } = await db
      .from('public_quote_intake_sessions')
      .select('coupon_code')
      .eq('id', session.id)
      .eq('company_id', session.company_id)
      .maybeSingle()
    if (sessionError) throw new PublicQuoteHttpError(500, 'server_error')

    const couponCode =
      typeof sessionRow?.coupon_code === 'string' ? sessionRow.coupon_code.trim() : ''
    let coupon: Record<string, unknown> | null = null
    let result = base

    if (couponCode) {
      const resolution = await resolveCouponForPricing({
        companyId: session.company_id,
        code: couponCode,
        eventDate:
          typeof draft.event?.eventDate === 'string'
            ? draft.event.eventDate
            : body.eventDate || '',
        packageId: parsed.packageId,
        breakdown: base.breakdown,
        contactPhone:
          typeof draft.contact?.phone === 'string' ? draft.contact.phone : null,
      })
      if (!resolution.valid) {
        await db
          .from('public_quote_intake_sessions')
          .update({ coupon_code: null })
          .eq('id', session.id)
          .eq('company_id', session.company_id)
          .eq('status', 'active')
        coupon = {
          invalidated: true,
          reason: resolution.reason ?? 'not_found',
        }
      } else {
        coupon = {
          code: resolution.coupon?.code,
          approvalStatus: resolution.approvalStatus,
          potentialDiscountAmount: resolution.potentialDiscountAmount,
          appliedDiscountAmount: resolution.appliedDiscountAmount,
        }
        if (resolution.appliedDiscountAmount > 0) {
          const discounted = await computeQuotePricing({
            ...pricingArgs,
            discountAmount: resolution.appliedDiscountAmount,
          })
          if (!discounted.ok) {
            throw new PublicQuoteHttpError(422, 'invalid_payload')
          }
          result = discounted
        }
      }
    }

    return NextResponse.json(
      {
        breakdown: result.breakdown,
        totals: result.totals,
        packagePricePerPerson: result.packagePricePerPerson,
        resolvedAdditionals: result.resolvedAdditionals,
        mileage,
        coupon,
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
