import { NextRequest, NextResponse } from 'next/server'
import { normalizeGrillRentalQty } from '@/Lib/grillRental'
import { computeQuotePricing } from '@/Lib/pricing/computeQuotePricing'
import {
  persistQuoteCouponApplication,
  resolveCouponForPricing,
  type CouponResolution,
} from '@/Lib/coupons/resolveCoupon'
import { resolvePublicQuoteMileageDistance } from '@/Lib/publicQuote/distance'
import {
  isOwnGrillWithoutPhoto,
  persistOwnGrillWithoutPhoto,
  rollbackPublicQuoteFinalize,
  toFinalizePayloadForCurrentRpc,
} from '@/Lib/publicQuote/ownGrillSubmitCompat'
import {
  assertHoneypot,
  assertRequestOrigin,
  PublicQuoteHttpError,
  publicErrorResponse,
  readLimitedJson,
  sha256,
  stableJsonHash,
} from '@/Lib/publicQuote/security'
import {
  consumePublicQuoteRateLimit,
  loadPublicQuoteSession,
  loadPublicQuoteSessionTenant,
} from '@/Lib/publicQuote/session'
import { validateCompletePublicQuoteDraft } from '@/Lib/publicQuote/validation'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'
import { CDL_CANCEL_POLICY_VERSION } from '@/Lib/cdlCancellationPolicy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

type SubmitBody = {
  idempotencyKey?: unknown
  submission?: unknown
  consent?: { accepted?: unknown; version?: unknown } | null
  cancellationConsent?: {
    accepted?: unknown
    version?: unknown
    locale?: unknown
    acceptedAt?: unknown
  } | null
  website?: unknown
}

function rpcErrorStatus(code: string) {
  if (code === 'expired') return 410
  if (code === 'conflict') return 409
  if (code === 'not_found') return 404
  if (code.startsWith('invalid_')) return 422
  return 500
}

export async function POST(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const body = await readLimitedJson<SubmitBody>(request)
    assertHoneypot(body?.website)
    if (!body || typeof body !== 'object') {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }

    const session = await loadPublicQuoteSession(request, { allowSubmitted: true })
    const tenant = await loadPublicQuoteSessionTenant(session)
    await consumePublicQuoteRateLimit(
      request,
      session.company_id,
      'submit',
      12,
      60 * 60,
    )

    const idempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(idempotencyKey)) {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }

    const contactConsent = body.consent?.accepted === true
    const privacyPolicyVersion =
      typeof body.consent?.version === 'string' ? body.consent.version.trim() : ''
    const cancellationAccepted = body.cancellationConsent?.accepted === true
    const cancellationVersion =
      typeof body.cancellationConsent?.version === 'string'
        ? body.cancellationConsent.version.trim()
        : ''
    if (
      !contactConsent ||
      !privacyPolicyVersion ||
      privacyPolicyVersion !== tenant.settings.consent_version ||
      !cancellationAccepted ||
      cancellationVersion !== CDL_CANCEL_POLICY_VERSION
    ) {
      throw new PublicQuoteHttpError(422, 'invalid_payload')
    }

    const draft = validateCompletePublicQuoteDraft(body.submission, {
      locale: session.locale,
      allowedCountries: tenant.settings.allowed_countries,
      companyId: session.company_id,
      sessionId: session.id,
    })
    const rules = await fetchSupabaseCommercialRules(session.company_id)
    const mileage = await resolvePublicQuoteMileageDistance(
      draft,
      rules.mileageBaseLocation,
      { referer: request.headers.get('origin') || request.nextUrl.origin },
    )
    const pricingArgs = {
      companyId: session.company_id,
      packageId: draft.selection.packageId,
      additionals: draft.selection.additionals,
      guestCounts: {
        adultCount: draft.event.adultCount,
        childrenUnder3Count: draft.event.childrenUnder3Count ?? 0,
        children4To12Count: draft.event.children4To12Count ?? 0,
      },
      eventDate: draft.event.eventDate,
      mileageDistance: mileage.distance,
      grillRentalRequired: draft.grill.rentalRequired,
      grillRentalQty: normalizeGrillRentalQty(draft.grill.rentalRequired),
      reservationPercentage: null,
      reservationAmountOverride: null,
      useCustomReservation: false,
      language: session.locale,
      requireSupabaseRules: true,
    } as const

    const basePricing = await computeQuotePricing({
      ...pricingArgs,
      discountAmount: 0,
    })
    if (!basePricing.ok) {
      console.warn('[public-quote] submit pricing rejected', {
        code: basePricing.error.code,
        field: basePricing.error.field ?? null,
      })
      throw new PublicQuoteHttpError(422, 'invalid_payload')
    }

    const supabase = getSupabaseServerClient()
    const { data: sessionCoupon, error: sessionCouponError } = await supabase
      .from('public_quote_intake_sessions')
      .select('coupon_code')
      .eq('id', session.id)
      .eq('company_id', session.company_id)
      .maybeSingle()
    if (sessionCouponError) throw new PublicQuoteHttpError(500, 'server_error')

    const couponCode =
      typeof sessionCoupon?.coupon_code === 'string'
        ? sessionCoupon.coupon_code.trim()
        : ''
    let couponResolution: CouponResolution | null = null
    let pricing = basePricing

    if (couponCode) {
      couponResolution = await resolveCouponForPricing({
        companyId: session.company_id,
        code: couponCode,
        eventDate: draft.event.eventDate,
        packageId: draft.selection.packageId,
        breakdown: basePricing.breakdown,
        contactPhone: draft.contact.phone,
      })
      if (!couponResolution.valid) {
        console.warn('[public-quote] coupon rejected at submit', {
          reason: couponResolution.reason ?? 'unknown',
          code: couponCode,
        })
        throw new PublicQuoteHttpError(422, 'invalid_payload')
      }
      if (couponResolution.appliedDiscountAmount > 0) {
        const discounted = await computeQuotePricing({
          ...pricingArgs,
          discountAmount: couponResolution.appliedDiscountAmount,
        })
        if (!discounted.ok) {
          throw new PublicQuoteHttpError(422, 'invalid_payload')
        }
        pricing = discounted
      }
    }

    const idempotencyKeyHash = sha256(idempotencyKey)
    const submissionHash = stableJsonHash({
      draft,
      consentVersion: privacyPolicyVersion,
      cancellationPolicyVersion: CDL_CANCEL_POLICY_VERSION,
      coupon: couponResolution?.valid
        ? {
            code: couponResolution.coupon?.code ?? couponCode,
            approvalStatus: couponResolution.approvalStatus,
            potentialDiscountAmount: couponResolution.potentialDiscountAmount,
            appliedDiscountAmount: couponResolution.appliedDiscountAmount,
          }
        : null,
    })
    const ownGrillWithoutPhoto = isOwnGrillWithoutPhoto(draft)
    const rpcPayload = toFinalizePayloadForCurrentRpc(draft)
    const { data, error } = await supabase.rpc('finalize_public_quote', {
      p_token_hash: session.token_hash,
      p_idempotency_key_hash: idempotencyKeyHash,
      p_submission_hash: submissionHash,
      p_payload: rpcPayload,
      p_pricing: {
        breakdown: {
          ...pricing.breakdown,
          mileageReviewRequired: mileage.status === 'pending_review',
        },
        totals: pricing.totals,
        packagePricePerPerson: pricing.packagePricePerPerson,
        resolvedAdditionals: pricing.resolvedAdditionals,
        mileageDistance: mileage.distance,
        mileageStatus: mileage.status,
        coupon: couponResolution?.valid
          ? {
              id: couponResolution.coupon?.id,
              code: couponResolution.coupon?.code,
              campaignName: couponResolution.coupon?.campaign_name,
              approvalStatus: couponResolution.approvalStatus,
              eligibleAmount: couponResolution.eligibleAmount,
              potentialDiscountAmount: couponResolution.potentialDiscountAmount,
              appliedDiscountAmount: couponResolution.appliedDiscountAmount,
            }
          : null,
      },
      p_consent_version: privacyPolicyVersion,
    })
    if (error || !data || typeof data !== 'object') {
      console.error('[public-quote] finalize_public_quote failed', {
        code: error?.code ?? null,
        message: error?.message ?? null,
        stage: 'rpc',
      })
      throw new PublicQuoteHttpError(500, 'server_error')
    }
    const result = data as {
      ok?: boolean
      error?: string
      alreadySubmitted?: boolean
      quote?: {
        id?: string
        number?: string | null
        eventName?: string
        eventDate?: string
        total?: number
        currency?: string
      }
    }
    if (!result.ok || !result.quote?.id) {
      const code = result.error || 'server_error'
      console.warn('[public-quote] finalize_public_quote rejected', {
        error: code,
        stage: 'rpc_validation',
        additionalCount: draft.selection.additionals.length,
        pricedCount: Array.isArray(pricing.resolvedAdditionals)
          ? pricing.resolvedAdditionals.length
          : null,
      })
      throw new PublicQuoteHttpError(
        rpcErrorStatus(code),
        code === 'expired'
          ? 'expired'
          : code === 'conflict'
            ? 'conflict'
            : code === 'not_found'
              ? 'not_found'
              : code === 'invalid_event_date'
                ? 'invalid_event_date'
                : code.startsWith('invalid_')
                  ? 'invalid_payload'
                  : 'server_error',
      )
    }

    if (result.alreadySubmitted !== true) {
      if (ownGrillWithoutPhoto) {
        const persisted = await persistOwnGrillWithoutPhoto(
          supabase,
          session.company_id,
          result.quote.id,
        )
        if (!persisted) {
          console.error('[public-quote] own-grill no-photo persist failed', {
            stage: 'own_grill_correction',
          })
          await rollbackPublicQuoteFinalize(
            supabase,
            session.company_id,
            result.quote.id,
            session.id,
          )
          throw new PublicQuoteHttpError(500, 'server_error')
        }
      }

      if (couponResolution?.valid) {
        const persistedCoupon = await persistQuoteCouponApplication({
          companyId: session.company_id,
          quoteId: result.quote.id,
          resolution: couponResolution,
          breakdown: pricing.breakdown,
        })
        if (!persistedCoupon) {
          console.error('[public-quote] coupon persistence failed', {
            stage: 'coupon_snapshot',
            code: couponResolution.coupon?.code ?? couponCode,
          })
          await rollbackPublicQuoteFinalize(
            supabase,
            session.company_id,
            result.quote.id,
            session.id,
          )
          throw new PublicQuoteHttpError(500, 'server_error')
        }
      }
    }

    if (result.quote && couponResolution?.valid && couponResolution.appliedDiscountAmount > 0) {
      result.quote.total = pricing.breakdown.total
    }

    return NextResponse.json(
      {
        quote: result.quote,
        alreadySubmitted: result.alreadySubmitted === true,
        coupon: couponResolution?.valid
          ? {
              code: couponResolution.coupon?.code,
              approvalStatus: couponResolution.approvalStatus,
              potentialDiscountAmount: couponResolution.potentialDiscountAmount,
              appliedDiscountAmount: couponResolution.appliedDiscountAmount,
            }
          : null,
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
