import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ found: false })
  }

  const db = getSupabaseServerClient()
  const rpc = await db.rpc('get_public_supplier_garnish', {
    p_token: token.trim(),
  })
  if (!rpc.error && rpc.data) {
    return Response.json(rpc.data)
  }

  const { data: order, error } = await db
    .from('service_orders')
    .select(
      'id, company_id, service_order_number, event_date, start_time, end_time, address_line, city, state, billable_guest_count, status, supplier_customer_id, supplier_garnish_pickup_time, supplier_garnish_response, supplier_garnish_sent_at, commercial_snapshot',
    )
    .eq('supplier_garnish_token', token.trim())
    .maybeSingle()

  if (error) {
    if (/supplier_garnish_/i.test(error.message)) {
      return Response.json({ found: false, error: 'migration_required' })
    }
    return Response.json({ found: false, error: error.message }, { status: 500 })
  }
  if (!order) return Response.json({ found: false })

  const [companyRes, supplierRes, agendaRes] = await Promise.all([
    db
      .from('companies')
      .select('name, trade_name')
      .eq('id', order.company_id)
      .maybeSingle(),
    order.supplier_customer_id
      ? db
          .from('customers')
          .select('ab_name, full_name')
          .eq('id', order.supplier_customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('agenda_events')
      .select('team_id, operational_teams(name)')
      .eq('service_order_id', order.id)
      .limit(1)
      .maybeSingle(),
  ])

  const teamJoin = agendaRes.data?.operational_teams as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined
  const teamName = Array.isArray(teamJoin)
    ? teamJoin[0]?.name
    : teamJoin?.name

  const snapshot = (order.commercial_snapshot ?? {}) as {
    package?: { label?: string; key?: string }
  }

  return Response.json({
    found: true,
    company_name:
      companyRes.data?.trade_name || companyRes.data?.name || 'BBQ At Home',
    supplier_garnish_response: order.supplier_garnish_response ?? 'pending',
    supplier_garnish_sent_at: order.supplier_garnish_sent_at,
    can_respond:
      (order.supplier_garnish_response ?? 'pending') === 'pending' &&
      Boolean(order.supplier_garnish_sent_at) &&
      order.status !== 'cancelled',
    order: {
      service_order_id: order.id,
      service_order_number: order.service_order_number,
      event_date: order.event_date,
      start_time: order.start_time,
      end_time: order.end_time,
      pickup_time: order.supplier_garnish_pickup_time,
      address:
        [order.address_line, order.city, order.state].filter(Boolean).join(', ') ||
        null,
      team_name: teamName ?? null,
      supplier_name:
        supplierRes.data?.ab_name || supplierRes.data?.full_name || null,
      guest_count: order.billable_guest_count,
      package_label: snapshot.package?.label || snapshot.package?.key || null,
      status: order.status,
    },
  })
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 400 })
  }

  let body: { action?: string }
  try {
    body = (await request.json()) as { action?: string }
  } catch {
    return Response.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (body.action !== 'confirm') {
    return Response.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const rpc = await db.rpc('confirm_supplier_garnish', {
    p_token: token.trim(),
  })
  if (!rpc.error && rpc.data) {
    return Response.json({ data: rpc.data })
  }

  const { data: order, error } = await db
    .from('service_orders')
    .select(
      'id, status, supplier_garnish_response, supplier_garnish_sent_at',
    )
    .eq('supplier_garnish_token', token.trim())
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!order) {
    return Response.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }
  if (!order.supplier_garnish_sent_at) {
    return Response.json(
      { error: 'Pedido ainda não foi enviado ao fornecedor' },
      { status: 400 },
    )
  }
  if ((order.supplier_garnish_response ?? 'pending') !== 'pending') {
    return Response.json({ error: 'Pedido já confirmado' }, { status: 400 })
  }
  if (order.status === 'cancelled') {
    return Response.json(
      { error: 'Ordem de serviço cancelada' },
      { status: 400 },
    )
  }

  const confirmedAt = new Date().toISOString()
  const { error: updError } = await db
    .from('service_orders')
    .update({
      supplier_garnish_response: 'confirmed',
      supplier_garnish_confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    })
    .eq('id', order.id)

  if (updError) {
    return Response.json({ error: updError.message }, { status: 500 })
  }

  return Response.json({
    data: {
      supplier_garnish_response: 'confirmed',
      supplier_garnish_confirmed_at: confirmedAt,
    },
  })
}
