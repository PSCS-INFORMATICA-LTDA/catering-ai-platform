import { NextRequest, NextResponse } from 'next/server'
import { normalizeGrillRentalQty } from '@/Lib/grillRental'
import { computeQuotePricing } from '@/Lib/pricing/computeQuotePricing'
import {
  normalizeCouponCode,
  resolveCouponForPricing,
  type CouponResolution,
} from '@/Lib/coupons/resolveCoupon'
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
import { validateCompletePublicQuoteDraft } from '@/Lib/publicQuote/validation'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }
type Body = { code?: unknown }

async function storedCode(sessionId: string, companyId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from('public_quote_intake_sessions')
    .select('coupon_code')
    .eq('id', sessionId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) throw new PublicQuoteHttpError(500, 'server_error')
  return typeof data?.coupon_code === 'string' ? data.coupon_code : null
}

async function saveCode(sessionId: string, companyId: string, code: string | null) {
  const { error } = await getSupabaseServerClient()
    .from('public_quote_intake_sessions')
    .update({ coupon_code: code })
    .eq('id', sessionId)
    .eq('company_id', companyId)
    .eq('status', 'active')
  if (error) throw new PublicQuoteHttpError(500, 'server_error')
}

async function resolve(request: NextRequest, code: string) {
  const session = await loadPublicQuoteSession(request)
  const tenant = await loadPublicQuoteSessionTenant(session)
  await consumePublicQuoteRateLimit(
    request,
    session.company_id,
    'preview',
    120,
    60 * 60,
  )
  const draft = validateCompletePublicQuoteDraft(session.draft, {
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
  const base = await computeQuotePricing({ ...pricingArgs, discountAmount: 0 })
  if (!base.ok) throw new PublicQuoteHttpError(422, 'invalid_payload')
  const resolution = await resolveCouponForPricing({
    companyId: session.company_id,
    code,
    eventDate: draft.event.eventDate,
    packageId: draft.selection.packageId,
    breakdown: base.breakdown,
    contactPhone: draft.contact.phone,
  })
  const final =
    resolution.valid && resolution.appliedDiscountAmount > 0
      ? await computeQuotePricing({
          ...pricingArgs,
          discountAmount: resolution.appliedDiscountAmount,
        })
      : base
  if (!final.ok) throw new PublicQuoteHttpError(422, 'invalid_payload')
  return {
    session,
    resolution,
    pricing: {
      subtotal: final.breakdown.subtotal,
      total: final.breakdown.total,
      deposit: final.breakdown.deposit,
      balance: final.breakdown.balance,
    },
  }
}

function payload(resolution: CouponResolution, pricing: Record<string, number>) {
  const coupon = resolution.coupon
  return {
    coupon: coupon
      ? {
          code: coupon.code,
          campaignName: coupon.campaign_name,
          description: coupon.description,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          manualApprovalRequired: resolution.manualApprovalRequired,
          approvalStatus: resolution.approvalStatus,
          eligibleAmount: resolution.eligibleAmount,
          potentialDiscountAmount: resolution.potentialDiscountAmount,
          appliedDiscountAmount: resolution.appliedDiscountAmount,
          totalBeforeCoupon: resolution.totalBeforeCoupon,
          totalAfterCoupon: resolution.totalAfterCoupon,
          projectedTotalAfterApproval: resolution.projectedTotalAfterApproval,
        }
      : null,
    pricing,
  }
}

export async function GET(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const session = await loadPublicQuoteSession(request)
    const code = await storedCode(session.id, session.company_id)
    if (!code) return NextResponse.json({ coupon: null }, { headers: NO_STORE })
    const result = await resolve(request, code)
    if (!result.resolution.valid) {
      await saveCode(session.id, session.company_id, null)
      return NextResponse.json(
        { coupon: null, reason: result.resolution.reason },
        { headers: NO_STORE },
      )
    }
    return NextResponse.json(payload(result.resolution, result.pricing), {
      headers: NO_STORE,
    })
  } catch (error) {
    const result = publicErrorResponse(error)
    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const body = await readLimitedJson<Body>(request)
    const session = await loadPublicQuoteSession(request)
    const raw = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!raw) {
      await saveCode(session.id, session.company_id, null)
      return NextResponse.json({ coupon: null, cleared: true }, { headers: NO_STORE })
    }
    const code = normalizeCouponCode(raw)
    if (!code) {
      return NextResponse.json(
        { coupon: null, reason: 'not_found' },
        { status: 422, headers: NO_STORE },
      )
    }
    const result = await resolve(request, code)
    if (!result.resolution.valid) {
      return NextResponse.json(
        {
          coupon: null,
          reason: result.resolution.reason,
          eligibleAmount: result.resolution.eligibleAmount,
        },
        { status: 422, headers: NO_STORE },
      )
    }
    await saveCode(session.id, session.company_id, code)
    return NextResponse.json(payload(result.resolution, result.pricing), {
      headers: NO_STORE,
    })
  } catch (error) {
    const result = publicErrorResponse(error)
    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE,
    })
  }
}
