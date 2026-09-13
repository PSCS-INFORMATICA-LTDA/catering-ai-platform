import {
  requireApiPermission,
  requireSessionCompanyId,
} from '@/Lib/auth/requireApi'
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
  if (application.approval_status !== 'pending') return Response.json({ error: 'Esta solicitação já foi decidida.' }, { status: 409, headers: NO_STORE })

  const now = new Date().toISOString()
  if (action === 'reject') {
    const { error } = await db.from('quote_coupon_applications').update({
      approval_status: 'rejected',
      applied_discount_amount: 0,
      rejected_by: ctx.session.userId,
      rejected_at: now,
      updated_at: now,
    }).eq('id', id).eq('company_id', ctx.companyId).eq('approval_status', 'pending')
    if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
    return Response.json({ ok: true, status: 'rejected' }, { headers: NO_STORE })
  }

  const { count: invoiceCount, error: invoiceError } = await db.from('invoices').select('id', { count: 'exact', head: true })
    .eq('company_id', ctx.companyId).eq('quote_id', application.quote_id)
  if (invoiceError) return Response.json({ error: invoiceError.message }, { status: 500, headers: NO_STORE })
  if ((invoiceCount ?? 0) > 0) return Response.json({ error: 'A cotação já possui invoice. Revise o financeiro antes de aprovar o desconto.' }, { status: 409, headers: NO_STORE })

  const { data: quote, error: quoteError } = await db.from('quotes').select('id, pricing_breakdown, quote_total, deposit_amount')
    .eq('id', application.quote_id).eq('company_id', ctx.companyId).maybeSingle()
  if (quoteError) return Response.json({ error: quoteError.message }, { status: 500, headers: NO_STORE })
  if (!quote) return Response.json({ error: 'Cotação não encontrada.' }, { status: 404, headers: NO_STORE })
  const breakdown = quote.pricing_breakdown && typeof quote.pricing_breakdown === 'object'
    ? { ...(quote.pricing_breakdown as Record<string, unknown>) }
    : null
  if (!breakdown) return Response.json({ error: 'Cotação sem snapshot de preço.' }, { status: 409, headers: NO_STORE })

  const discount = money(Number(application.potential_discount_amount ?? 0))
  if (!(discount > 0)) return Response.json({ error: 'Desconto potencial inválido.' }, { status: 409, headers: NO_STORE })
  const originalTotal = money(Number(breakdown.total ?? quote.quote_total ?? 0))
  const deposit = money(Number(breakdown.deposit ?? quote.deposit_amount ?? 0))
  const total = money(Math.max(0, originalTotal - discount))
  const balance = money(Math.max(0, total - deposit))
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
    unit_price: -discount,
    amount: -discount,
    metadata: { campaign_name: application.campaign_name_snapshot, approved_manually: true },
  })
  const couponSnapshot = {
    id: application.coupon_id,
    code: application.coupon_code_snapshot,
    campaign_name: application.campaign_name_snapshot,
    approval_status: 'applied',
    potential_discount_amount: discount,
    applied_discount_amount: discount,
    rules_snapshot: application.rules_snapshot,
  }
  const updatedBreakdown = { ...breakdown, adjustments, total, balance, coupon: couponSnapshot }

  const quoteUpdate = await db.from('quotes').update({
    discount,
    discount_amount: discount,
    balance_due: balance,
    total_amount: total,
    quote_total: total,
    pricing_breakdown: updatedBreakdown,
  }).eq('id', application.quote_id).eq('company_id', ctx.companyId)
  if (quoteUpdate.error) return Response.json({ error: quoteUpdate.error.message }, { status: 500, headers: NO_STORE })

  const { data: versions, error: versionsError } = await db.from('quote_versions').select('id, commercial_snapshot')
    .eq('quote_id', application.quote_id).eq('company_id', ctx.companyId).eq('is_current', true)
  if (versionsError) return Response.json({ error: versionsError.message }, { status: 500, headers: NO_STORE })
  for (const version of versions ?? []) {
    const snapshot = version.commercial_snapshot && typeof version.commercial_snapshot === 'object'
      ? { ...(version.commercial_snapshot as Record<string, unknown>) }
      : {}
    const { error } = await db.from('quote_versions').update({
      discount_amount: discount,
      balance_due: balance,
      quote_total: total,
      commercial_snapshot: { ...snapshot, pricing_breakdown: updatedBreakdown, coupon: couponSnapshot },
    }).eq('id', version.id).eq('company_id', ctx.companyId)
    if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
  }

  const { error: updateError } = await db.from('quote_coupon_applications').update({
    approval_status: 'applied',
    applied_discount_amount: discount,
    approved_by: ctx.session.userId,
    approved_at: now,
    updated_at: now,
  }).eq('id', id).eq('company_id', ctx.companyId).eq('approval_status', 'pending')
  if (updateError) return Response.json({ error: updateError.message }, { status: 500, headers: NO_STORE })
  return Response.json({ ok: true, status: 'applied', total, balance }, { headers: NO_STORE })
}
