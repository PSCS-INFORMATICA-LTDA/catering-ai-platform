import {
  requireApiPermission,
  requireSessionCompanyId,
} from '@/Lib/auth/requireApi'
import { normalizeCouponCode } from '@/Lib/coupons/resolveCoupon'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

function text(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
function nullableText(value: unknown, max = 1000) {
  return text(value, max) || null
}
function nonNegative(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
function nullableNonNegative(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}
function positiveInt(value: unknown, fallback: number | null = null) {
  if (value == null || value === '') return fallback
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}
function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}
function date(value: unknown) {
  const v = text(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
function weekdays(value: unknown) {
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6]
  const unique = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
  return unique.length ? unique.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6]
}
function uuids(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(String).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))]
}

function payload(body: Record<string, unknown>, companyId: string) {
  const code = normalizeCouponCode(body.code)
  const campaign = text(body.campaign_name ?? body.campaignName, 160)
  const type = text(body.discount_type ?? body.discountType, 20) === 'percent' ? 'percent' : 'fixed'
  const value = nonNegative(body.discount_value ?? body.discountValue)
  const statusRaw = text(body.status, 20) || 'draft'
  const status = ['draft', 'active', 'paused', 'archived'].includes(statusRaw) ? statusRaw : 'draft'
  if (!code) return { error: 'Código de cupom inválido.' } as const
  if (!campaign) return { error: 'Nome da campanha é obrigatório.' } as const
  if (type === 'percent' && value > 100) return { error: 'Desconto percentual não pode ultrapassar 100%.' } as const
  const validFrom = date(body.valid_from ?? body.validFrom)
  const validTo = date(body.valid_to ?? body.validTo)
  if (validFrom && validTo && validTo < validFrom) return { error: 'Data final não pode ser anterior à data inicial.' } as const
  if (bool(body.apply_to_deposit ?? body.applyToDeposit)) {
    return { error: 'Aplicação no sinal fica bloqueada no V1. O cupom atua no saldo.' } as const
  }
  const allPackages = bool(body.all_packages ?? body.allPackages, true)
  return {
    data: {
      company_id: companyId,
      code,
      campaign_name: campaign,
      description: nullableText(body.description, 1200),
      status,
      discount_type: type,
      discount_value: value,
      max_discount_amount: nullableNonNegative(body.max_discount_amount ?? body.maxDiscountAmount),
      min_eligible_amount: nonNegative(body.min_eligible_amount ?? body.minEligibleAmount),
      valid_from: validFrom,
      valid_to: validTo,
      eligible_weekdays: weekdays(body.eligible_weekdays ?? body.eligibleWeekdays),
      all_packages: allPackages,
      eligible_package_ids: allPackages ? [] : uuids(body.eligible_package_ids ?? body.eligiblePackageIds),
      include_additionals: bool(body.include_additionals ?? body.includeAdditionals, true),
      include_grill: bool(body.include_grill ?? body.includeGrill),
      include_additional_cuts: bool(body.include_additional_cuts ?? body.includeAdditionalCuts),
      include_mileage: bool(body.include_mileage ?? body.includeMileage),
      new_customer_only: bool(body.new_customer_only ?? body.newCustomerOnly),
      max_uses_per_customer: positiveInt(body.max_uses_per_customer ?? body.maxUsesPerCustomer),
      max_uses_per_quote: positiveInt(body.max_uses_per_quote ?? body.maxUsesPerQuote, 1) ?? 1,
      stackable: bool(body.stackable),
      apply_to_deposit: false,
      apply_to_balance: bool(body.apply_to_balance ?? body.applyToBalance, true),
      allow_post_event_adjustment: bool(body.allow_post_event_adjustment ?? body.allowPostEventAdjustment),
      manual_approval_required: bool(body.manual_approval_required ?? body.manualApprovalRequired),
      distribution_channel: nullableText(body.distribution_channel ?? body.distributionChannel, 300),
      minimum_final_mon_thu: nullableNonNegative(body.minimum_final_mon_thu ?? body.minimumFinalMonThu),
      minimum_final_fri_sun: nullableNonNegative(body.minimum_final_fri_sun ?? body.minimumFinalFriSun),
      updated_at: new Date().toISOString(),
    },
  } as const
}

async function context(permission: 'commercial.coupons.view' | 'commercial.coupons.manage') {
  const auth = await requireApiPermission(permission)
  if (!auth.ok) return { ok: false as const, response: auth.response }
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return { ok: false as const, response: company.response }
  return { ok: true as const, companyId: company.companyId, session: auth.session }
}

export async function GET() {
  const ctx = await context('commercial.coupons.view')
  if (!ctx.ok) return ctx.response
  const db = getSupabaseServerClient()
  const [coupons, packages] = await Promise.all([
    db.from('coupons').select('*').eq('company_id', ctx.companyId).neq('status', 'archived').order('created_at', { ascending: false }),
    db.from('packages').select('id, package_key, package_name, label_pt, active').eq('company_id', ctx.companyId).eq('active', true).order('display_order', { ascending: true }),
  ])
  if (coupons.error) return Response.json({ error: coupons.error.message }, { status: 500, headers: NO_STORE })
  return Response.json({
    coupons: coupons.data ?? [],
    packages: packages.error ? [] : packages.data ?? [],
    canManage: ctx.session.isPlatformAdmin || ctx.session.permissions.includes('commercial.coupons.manage'),
  }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const ctx = await context('commercial.coupons.manage')
  if (!ctx.ok) return ctx.response
  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return Response.json({ error: 'Payload inválido.' }, { status: 400, headers: NO_STORE }) }
  const values = payload(body, ctx.companyId)
  if ('error' in values) return Response.json({ error: values.error }, { status: 400, headers: NO_STORE })
  const { data, error } = await getSupabaseServerClient().from('coupons').insert({
    ...values.data,
    created_at: new Date().toISOString(),
    created_by: ctx.session.userId,
    updated_by: ctx.session.userId,
  }).select('*').single()
  if (error) return Response.json({ error: error.code === '23505' ? 'Já existe um cupom com esse código.' : error.message }, { status: error.code === '23505' ? 409 : 500, headers: NO_STORE })
  return Response.json({ coupon: data }, { status: 201, headers: NO_STORE })
}

export async function PATCH(request: Request) {
  const ctx = await context('commercial.coupons.manage')
  if (!ctx.ok) return ctx.response
  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return Response.json({ error: 'Payload inválido.' }, { status: 400, headers: NO_STORE }) }
  const id = text(body.id, 64)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Cupom inválido.' }, { status: 400, headers: NO_STORE })
  const values = payload(body, ctx.companyId)
  if ('error' in values) return Response.json({ error: values.error }, { status: 400, headers: NO_STORE })
  const { data, error } = await getSupabaseServerClient().from('coupons').update({
    ...values.data,
    updated_by: ctx.session.userId,
  }).eq('id', id).eq('company_id', ctx.companyId).select('*').maybeSingle()
  if (error) return Response.json({ error: error.code === '23505' ? 'Já existe um cupom com esse código.' : error.message }, { status: error.code === '23505' ? 409 : 500, headers: NO_STORE })
  if (!data) return Response.json({ error: 'Cupom não encontrado.' }, { status: 404, headers: NO_STORE })
  return Response.json({ coupon: data }, { headers: NO_STORE })
}
