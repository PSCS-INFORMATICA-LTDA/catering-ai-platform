import { NextRequest, NextResponse } from 'next/server'
import { computeQuotePricing } from '@/Lib/pricing/computeQuotePricing'
import { resolvePublicQuoteMileageDistance } from '@/Lib/publicQuote/distance'
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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

type SubmitBody = {
  idempotencyKey?: unknown
  submission?: unknown
  consent?: { accepted?: unknown; version?: unknown } | null
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

    const session = await loadPublicQuoteSession(request, {
      allowSubmitted: true,
    })
    const tenant = await loadPublicQuoteSessionTenant(session)
    await consumePublicQuoteRateLimit(
      request,
      session.company_id,
      'submit',
      12,
      60 * 60,
    )

    const idempotencyKey =
      typeof body.idempotencyKey === 'string'
        ? body.idempotencyKey.trim()
        : ''
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(idempotencyKey)) {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }

    // A single explicit checkbox records contactConsent and acceptance of the
    // configured privacyPolicy version shown next to it.
    const contactConsent = body.consent?.accepted === true
    const privacyPolicyVersion =
      typeof body.consent?.version === 'string'
        ? body.consent.version.trim()
        : ''
    if (
      !contactConsent ||
      !privacyPolicyVersion ||
      privacyPolicyVersion !== tenant.settings.consent_version
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
    )
    const pricing = await computeQuotePricing({
      companyId: session.company_id,
      packageId: draft.selection.packageId,
      additionals: draft.selection.additionals,
      guestCounts: {
        adultCount: draft.event.adultCount,
        childrenUnder3Count: draft.event.childrenUnder3Count,
        children4To12Count: draft.event.children4To12Count,
      },
      eventDate: draft.event.eventDate,
      mileageDistance: mileage.distance,
      grillRentalRequired: draft.grill.rentalRequired,
      grillRentalQty: draft.grill.rentalQty,
      reservationPercentage: null,
      reservationAmountOverride: null,
      useCustomReservation: false,
      discountAmount: 0,
      language: session.locale,
      requireSupabaseRules: true,
    })
    if (!pricing.ok) {
      throw new PublicQuoteHttpError(422, 'invalid_payload')
    }

    const idempotencyKeyHash = sha256(idempotencyKey)
    const submissionHash = stableJsonHash({
      draft,
      consentVersion: privacyPolicyVersion,
    })
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.rpc('finalize_public_quote', {
      p_token_hash: session.token_hash,
      p_idempotency_key_hash: idempotencyKeyHash,
      p_submission_hash: submissionHash,
      p_payload: draft,
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
      },
      p_consent_version: privacyPolicyVersion,
    })
    if (error || !data || typeof data !== 'object') {
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
      throw new PublicQuoteHttpError(
        rpcErrorStatus(code),
        code === 'expired'
          ? 'expired'
          : code === 'conflict'
            ? 'conflict'
            : code === 'not_found'
              ? 'not_found'
              : code.startsWith('invalid_')
                ? 'invalid_payload'
                : 'server_error',
      )
    }

    return NextResponse.json(
      {
        quote: result.quote,
        alreadySubmitted: result.alreadySubmitted === true,
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
