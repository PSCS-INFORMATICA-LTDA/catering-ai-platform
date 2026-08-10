import { hashMaterialDispatchToken } from '@/Lib/orders/materialDispatchConfirmation'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ token: string }> }

const FINANCIAL_KEY =
  /^(unit_price|total_price|package_total|additional_total|mileage_fee|discount_amount|reservation_amount|balance_due|service_order_total|quote_total|price|subtotal|cost|margin|markup|deposit)$/i

function stripFinancial(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripFinancial)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FINANCIAL_KEY.test(k)) continue
      if (/token_hash|jwt|password|service_role/i.test(k)) continue
      out[k] = stripFinancial(v)
    }
    return out
  }
  return value
}

export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc(
    'get_public_material_dispatch_confirmation',
    { p_token: token },
  )
  if (error) {
    return Response.json({ found: false, error: error.message }, { status: 500 })
  }
  return Response.json(stripFinancial(data ?? { found: false }))
}

export async function POST(request: Request, context: Ctx) {
  const { token } = await context.params
  let body: {
    lines?: Array<{
      id: string
      dispatched_quantity: number
      justification?: string
    }>
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('confirm_public_material_dispatch', {
    p_token: token,
    p_lines: body.lines ?? null,
    p_notes: body.notes ?? null,
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const result = (data ?? { ok: false }) as {
    ok?: boolean
    status?: string
    idempotent?: boolean
    has_divergence?: boolean
    error?: string
  }

  if (result.ok && !result.idempotent) {
    const tokenHash = hashMaterialDispatchToken(token)
    const { data: conf } = await db
      .from('service_order_material_dispatch_confirmations')
      .select('id, company_id, service_order_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (conf?.company_id && conf.id) {
      await writeOperationalAudit({
        companyId: conf.company_id,
        actorUserId: null,
        entityType: 'service_order_material_dispatch',
        entityId: conf.id,
        action: result.has_divergence
          ? 'material_dispatch_divergence'
          : 'material_dispatch_confirmed',
        newData: {
          service_order_id: conf.service_order_id,
          public: true,
        },
      })
    }
  }

  return Response.json(result)
}
