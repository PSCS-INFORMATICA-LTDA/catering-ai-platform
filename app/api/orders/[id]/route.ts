import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { fetchServiceOrderDetail } from '@/Lib/orders/fetchServiceOrderDetail'
import {
  isValidServiceOrderTransition,
  serviceOrderStatusRequiresReason,
} from '@/Lib/orders/statusMachine'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await fetchServiceOrderDetail(companyId, id)

  if (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 500 })
  }

  return Response.json({ data })
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  let body: { status?: string; notes?: string; cancel_reason?: string }
  try {
    body = (await request.json()) as {
      status?: string
      notes?: string
      cancel_reason?: string
    }
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const { data: order, error: fetchError } = await db
    .from('service_orders')
    .select('id, company_id, status')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 })
  }
  if (!order) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.notes === 'string') {
    update.notes = body.notes
  }

  let statusChanged = false
  if (body.status && body.status !== order.status) {
    if (!isValidServiceOrderTransition(order.status, body.status)) {
      return Response.json(
        {
          error: `Transição de status inválida: ${order.status} → ${body.status}.`,
        },
        { status: 400 },
      )
    }

    if (serviceOrderStatusRequiresReason(body.status) && !body.cancel_reason?.trim()) {
      return Response.json(
        { error: 'Informe o motivo do cancelamento.' },
        { status: 400 },
      )
    }

    update.status = body.status
    statusChanged = true

    if (body.status === 'cancelled') {
      update.cancel_reason = body.cancel_reason?.trim()
      update.cancelled_at = new Date().toISOString()
    }
    if (body.status === 'completed') {
      update.completed_at = new Date().toISOString()
    }
  }

  const { data: updated, error: updateError } = await db
    .from('service_orders')
    .update(update)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .single()

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  if (statusChanged) {
    await db.from('service_order_status_history').insert({
      company_id: companyId,
      service_order_id: id,
      from_status: order.status,
      to_status: body.status,
      reason: body.cancel_reason?.trim() ?? null,
      changed_by: auth.session.userId,
    })

    try {
      await db.from('audit_logs').insert({
        company_id: companyId,
        user_id: auth.session.userId,
        entity_type: 'service_order',
        entity_id: id,
        action: 'update_status',
        old_data: { status: order.status },
        new_data: { status: body.status },
      })
    } catch (err) {
      console.warn(
        '[Orders] audit_logs indisponível, seguindo sem bloquear:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return Response.json({ data: updated })
}
