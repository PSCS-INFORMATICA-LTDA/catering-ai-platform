import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  buildPublicSupplierGarnishUrl,
  newSupplierGarnishToken,
  normalizePickupTimeForDb,
} from '@/Lib/supplierGarnish'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

type GarnishRow = {
  id: string
  service_order_number: string
  supplier_garnish_token: string | null
  supplier_garnish_response: string | null
  supplier_garnish_sent_at: string | null
  supplier_garnish_confirmed_at: string | null
  supplier_customer_id: string | null
  supplier_garnish_pickup_time: string | null
}

function payload(row: GarnishRow) {
  const token = row.supplier_garnish_token
  return {
    service_order_id: row.id,
    service_order_number: row.service_order_number,
    supplier_customer_id: row.supplier_customer_id,
    pickup_time: row.supplier_garnish_pickup_time
      ? String(row.supplier_garnish_pickup_time).slice(0, 5)
      : null,
    supplier_garnish_token: token,
    supplier_garnish_response: row.supplier_garnish_response ?? 'pending',
    supplier_garnish_sent_at: row.supplier_garnish_sent_at,
    supplier_garnish_confirmed_at: row.supplier_garnish_confirmed_at,
    public_url: token ? buildPublicSupplierGarnishUrl(token) : null,
  }
}

const SELECT_COLS =
  'id, service_order_number, supplier_garnish_token, supplier_garnish_response, supplier_garnish_sent_at, supplier_garnish_confirmed_at, supplier_customer_id, supplier_garnish_pickup_time'

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('service_orders')
    .select(SELECT_COLS)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    if (/supplier_garnish_/i.test(error.message)) {
      return Response.json(
        { error: 'migration_required', detail: error.message },
        { status: 503 },
      )
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  return Response.json({ data: payload(data as GarnishRow) })
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  let body: {
    action?: string
    supplier_customer_id?: string | null
    pickup_time?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const action = body.action?.trim()
  if (
    action !== 'ensure_token' &&
    action !== 'mark_sent' &&
    action !== 'mark_confirmed'
  ) {
    return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const { data: order, error: fetchError } = await db
    .from('service_orders')
    .select(SELECT_COLS)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    if (/supplier_garnish_/i.test(fetchError.message)) {
      return Response.json(
        { error: 'migration_required', detail: fetchError.message },
        { status: 503 },
      )
    }
    return Response.json({ error: fetchError.message }, { status: 500 })
  }
  if (!order) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  const row = order as GarnishRow
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.supplier_customer_id !== undefined) {
    patch.supplier_customer_id = body.supplier_customer_id || null
  }
  if (body.pickup_time !== undefined) {
    patch.supplier_garnish_pickup_time = normalizePickupTimeForDb(
      body.pickup_time,
    )
  }

  if (action === 'ensure_token' || action === 'mark_sent') {
    if (!row.supplier_garnish_token) {
      patch.supplier_garnish_token = newSupplierGarnishToken()
    }
  }

  if (action === 'mark_sent') {
    patch.supplier_garnish_sent_at = new Date().toISOString()
    if ((row.supplier_garnish_response ?? 'pending') === 'pending') {
      // reenvio mantém pending até confirmação pública
    }
  }

  if (action === 'mark_confirmed') {
    patch.supplier_garnish_response = 'confirmed'
    patch.supplier_garnish_confirmed_at = new Date().toISOString()
    if (!row.supplier_garnish_sent_at) {
      patch.supplier_garnish_sent_at = new Date().toISOString()
    }
    if (!row.supplier_garnish_token) {
      patch.supplier_garnish_token = newSupplierGarnishToken()
    }
  }

  const { data: updated, error: updError } = await db
    .from('service_orders')
    .update(patch)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(SELECT_COLS)
    .maybeSingle()

  if (updError) {
    return Response.json({ error: updError.message }, { status: 500 })
  }

  return Response.json({ data: payload((updated ?? row) as GarnishRow) })
}
