import {
  requireApiPermission,
  requireSessionCompanyId,
} from '@/Lib/auth/requireApi'
import { allocateApprovedCoupon } from '@/Lib/coupons/couponMath'
import { buildRejectedCouponQuotePatch } from '@/Lib/coupons/couponSnapshot'
import { decideQuoteCouponFallback } from '@/Lib/coupons/decideQuoteCoupon'
import {
  classifyCouponDecideError,
  isMissingCouponDecideFunction,
} from '@/Lib/coupons/couponPersistError'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

async function context() {
  const auth = await requireApiPermission('commercial.coupons.manage')
  if (!auth.ok) return { ok: false as const, response: auth.response }
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return { ok: false as const, response: company.response }
  return { ok: true as const, companyId: company.companyId, session: auth.session }
}

export async function GET() {
  const ctx = await context()
  if (!ctx.ok) return ctx.response
  const db = getSupabaseServerClient()
  const { data: applications, error } = await db
    .from('quote_coupon_applications')
    .select('*')
    .eq('company_id', ctx.companyId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })

  const quoteIds = (applications ?? []).map((row) => String(row.quote_id))
  const { data: quotes } = quoteIds.length
    ? await db.from('quotes').select('id, quote_number, quote_total, customer_id').eq('company_id', ctx.companyId).in('id', quoteIds)
    : { data: [] }
  const customerIds = (quotes ?? []).map((row) => row.customer_id).filter(Boolean) as string[]
  const { data: customers } = customerIds.length
    ? await db.from('customers').select('id, full_name, ab_name').eq('company_id', ctx.companyId).in('id', customerIds)
    : { data: [] }
  const quoteMap = new Map((quotes ?? []).map((row) => [String(row.id), row]))
  const customerMap = new Map((customers ?? []).map((row) => [String(row.id), row]))

  return Response.json({
    applications: (applications ?? []).map((application) => {
      const quote = quoteMap.get(String(application.quote_id))
      const customer = quote?.customer_id ? customerMap.get(String(quote.customer_id)) : null
      return {
        ...application,
        quote_number: quote?.quote_number ?? null,
        quote_total: quote?.quote_total ?? null,
        customer_name: customer?.full_name || customer?.ab_name || null,
      }
    }),
  }, { headers: NO_STORE })
}

export async function PATCH(request: Request) {
  const ctx = await context()
  if (!ctx.ok) return ctx.response
  let body: { id?: unknown; action?: unknown }
  try { body = (await request.json()) as { id?: unknown; action?: unknown } }
  catch { return Response.json({ error: 'Payload inválido.' }, { status: 400, headers: NO_STORE }) }
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const action = body.action === 'approve' || body.action === 'reject' ? body.action : null
  if (!/^[0-9a-f-]{36}$/i.test(id) || !action) return Response.json({ error: 'Solicitação inválida.' }, { status: 400, headers: NO_STORE })

  const db = getSupabaseServerClient()
  const { data: application, error: applicationError } = await db
    .from('quote_coupon_applications').select('*').eq('id', id).eq('company_id', ctx.companyId).maybeSingle()
  if (applicationError) return Response.json({ error: applicationError.message }, { status: 500, headers: NO_STORE })
  if (!application) return Response.json({ error: 'Solicitação não encontrada.' }, { status: 404, headers: NO_STORE })
  if (application.approval_status === 'applied' && action === 'approve') {
    return Response.json({ ok: true, status: 'applied', idempotent: true }, { headers: NO_STORE })
  }
  if (application.approval_status === 'rejected' && action === 'reject') {
    return Response.json({ ok: true, status: 'rejected', idempotent: true }, { headers: NO_STORE })
  }
  if (application.approval_status !== 'pending') {
    return Response.json({ error: 'Esta solicitação já foi decidida.' }, { status: 409, headers: NO_STORE })
  }

  const now = new Date().toISOString()
  let quotePatch: Record<string, unknown> | null = null
  let allocation: ReturnType<typeof allocateApprovedCoupon> | null = null

  if (action === 'reject') {
    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .select('id, pricing_breakdown, quote_total, total_amount, deposit_amount, reservation_amount, balance_due')
      .eq('id', application.quote_id)
      .eq('company_id', ctx.companyId)
      .maybeSingle()
    if (quoteError) return Response.json({ error: 'Falha ao carregar a cotação.' }, { status: 500, headers: NO_STORE })
    if (!quote) return Response.json({ error: 'Cotação não encontrada.' }, { status: 404, headers: NO_STORE })
    quotePatch = buildRejectedCouponQuotePatch(quote, now)
    if (!quotePatch) return Response.json({ error: 'Cotação sem snapshot de preço.' }, { status: 409, headers: NO_STORE })
  }

  if (action === 'approve') {
    const { count: invoiceCount, error: invoiceError } = await db.from('invoices').select('id', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId).eq('quote_id', application.quote_id)
    if (invoiceError) return Response.json({ error: 'Falha ao validar o financeiro da cotação.' }, { status: 500, headers: NO_STORE })
    if ((invoiceCount ?? 0) > 0) return Response.json({ error: 'A cotação já possui invoice. Revise o financeiro antes de aprovar o desconto.' }, { status: 409, headers: NO_STORE })

    const { data: quote, error: quoteError } = await db.from('quotes').select('id, pricing_breakdown, quote_total, deposit_amount, reservation_amount')
      .eq('id', application.quote_id).eq('company_id', ctx.companyId).maybeSingle()
    if (quoteError) return Response.json({ error: 'Falha ao carregar a cotação.' }, { status: 500, headers: NO_STORE })
    if (!quote) return Response.json({ error: 'Cotação não encontrada.' }, { status: 404, headers: NO_STORE })
    const breakdown = quote.pricing_breakdown && typeof quote.pricing_breakdown === 'object'
      ? { ...(quote.pricing_breakdown as Record<string, unknown>) }
      : null
    if (!breakdown) return Response.json({ error: 'Cotação sem snapshot de preço.' }, { status: 409, headers: NO_STORE })

    const rules = application.rules_snapshot && typeof application.rules_snapshot === 'object'
      ? (application.rules_snapshot as Record<string, unknown>)
      : {}
    const discount = money(Number(application.potential_discount_amount ?? 0))
    if (!(discount > 0)) return Response.json({ error: 'Desconto potencial inválido.' }, { status: 409, headers: NO_STORE })
    const originalTotal = money(Number(breakdown.total ?? quote.quote_total ?? 0))
    const deposit = money(Number(breakdown.deposit ?? quote.reservation_amount ?? quote.deposit_amount ?? 0))
    allocation = allocateApprovedCoupon({
      total: originalTotal,
      deposit,
      authorizedDiscount: discount,
      applyToDeposit: rules.apply_to_deposit === true,
      applyToBalance: rules.apply_to_balance !== false,
    })
    if ('error' in allocation) {
      return Response.json({ error: 'Configuração financeira do cupom inválida.' }, { status: 409, headers: NO_STORE })
    }
    const adjustments = Array.isArray(breakdown.adjustments)
      ? (breakdown.adjustments as Array<Record<string, unknown>>).filter((line) => line.line_key !== 'discount')
      : []
    adjustments.push({
      line_key: 'discount',
      source_type: 'discount',
      source_id: application.coupon_id,
      description: `Cupom ${application.coupon_code_snapshot}`,
      quantity: 1,
      unit: 'adjustment',
      unit_price: -allocation.authorizedDiscount,
      amount: -allocation.authorizedDiscount,
      metadata: {
        campaign_name: application.campaign_name_snapshot,
        approved_manually: true,
        apply_to_deposit: allocation.applyToDeposit,
        apply_to_balance: allocation.applyToBalance,
      },
    })
    const couponSnapshot = {
      id: application.coupon_id,
      code: application.coupon_code_snapshot,
      campaign_name: application.campaign_name_snapshot,
      discount_type: rules.discount_type ?? null,
      discount_value: rules.discount_value ?? null,
      approval_status: 'applied',
      eligible_amount: application.eligible_amount,
      potential_discount_amount: discount,
      applied_discount_amount: allocation.authorizedDiscount,
      deposit_discount_amount: allocation.fromDeposit,
      balance_discount_amount: allocation.fromBalance,
      apply_to_deposit: allocation.applyToDeposit,
      apply_to_balance: allocation.applyToBalance,
      currency: 'USD',
      approved_at: now,
      applied_at: now,
      rules_snapshot: application.rules_snapshot,
    }
    const updatedBreakdown = {
      ...breakdown,
      adjustments,
      total: allocation.finalTotal,
      deposit: allocation.depositDue,
      balance: allocation.balanceDue,
      coupon: couponSnapshot,
    }
    quotePatch = {
      discount: allocation.authorizedDiscount,
      discount_amount: allocation.authorizedDiscount,
      reservation_amount: allocation.depositDue,
      deposit_amount: allocation.depositDue,
      balance_due: allocation.balanceDue,
      total_amount: allocation.finalTotal,
      quote_total: allocation.finalTotal,
      pricing_breakdown: updatedBreakdown,
      coupon_snapshot: couponSnapshot,
    }
  }

  const decided = await db.rpc('decide_quote_coupon_application', {
    p_company_id: ctx.companyId,
    p_application_id: id,
    p_decision: action,
    p_reviewed_by: ctx.session.userId,
    p_quote_patch: quotePatch,
  })
  if (decided.error) {
    if (isMissingCouponDecideFunction(decided.error)) {
      console.warn('[coupon-decide]', JSON.stringify({ via: 'fallback', action, applicationId: id }))
      const fallback = await decideQuoteCouponFallback({
        db,
        companyId: ctx.companyId,
        applicationId: id,
        quoteId: String(application.quote_id),
        userId: ctx.session.userId,
        action,
        quotePatch: quotePatch as Parameters<typeof decideQuoteCouponFallback>[0]['quotePatch'],
      })
      if (!fallback.ok) {
        return Response.json({ error: fallback.error }, { status: fallback.status, headers: NO_STORE })
      }
      if (fallback.status === 'rejected') {
        return Response.json({
          ok: true,
          status: 'rejected',
          idempotent: fallback.idempotent === true,
          via: 'fallback',
        }, { headers: NO_STORE })
      }
      return Response.json({
        ok: true,
        status: 'applied',
        idempotent: fallback.idempotent === true,
        via: 'fallback',
        total: allocation && !('error' in allocation) ? allocation.finalTotal : undefined,
        deposit: allocation && !('error' in allocation) ? allocation.depositDue : undefined,
        balance: allocation && !('error' in allocation) ? allocation.balanceDue : undefined,
      }, { headers: NO_STORE })
    }
    const reason = classifyCouponDecideError(decided.error)
    const status =
      reason === 'not_found' ? 404
        : reason === 'invalid_arguments' ? 400
          : reason === 'already_decided' || reason === 'invoice_exists' ? 409
            : 500
    const message =
      reason === 'already_decided' ? 'Esta solicitação já foi decidida.'
        : reason === 'invoice_exists' ? 'A cotação já possui invoice. Revise o financeiro antes de aprovar o desconto.'
          : reason === 'not_found' ? 'Solicitação não encontrada.'
            : reason === 'invalid_arguments' ? 'Solicitação inválida.'
              : action === 'reject' ? 'Não foi possível rejeitar o cupom.'
                : 'Não foi possível aprovar o cupom.'
    return Response.json({ error: message }, { status, headers: NO_STORE })
  }

  const result = decided.data && typeof decided.data === 'object'
    ? (decided.data as { ok?: boolean; status?: string; idempotent?: boolean; total?: number; deposit?: number; balance?: number })
    : {}
  console.info('[coupon-decide]', JSON.stringify({
    via: 'rpc',
    action,
    applicationId: id,
    status: result.status ?? (action === 'reject' ? 'rejected' : 'applied'),
    idempotent: result.idempotent === true,
  }))
  if (action === 'reject') {
    return Response.json({
      ok: true,
      status: 'rejected',
      idempotent: result.idempotent === true,
      via: 'rpc',
    }, { headers: NO_STORE })
  }

  return Response.json({
    ok: true,
    status: 'applied',
    idempotent: result.idempotent === true,
    via: 'rpc',
    total: allocation && !('error' in allocation) ? allocation.finalTotal : result.total,
    deposit: allocation && !('error' in allocation) ? allocation.depositDue : result.deposit,
    balance: allocation && !('error' in allocation) ? allocation.balanceDue : result.balance,
  }, { headers: NO_STORE })
}
