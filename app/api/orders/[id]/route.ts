import { hasPermission } from '@/Lib/auth/permissions'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { fetchServiceOrderDetail } from '@/Lib/orders/fetchServiceOrderDetail'
import { sanitizeServiceOrderListRowForActor } from '@/Lib/orders/sanitizeServiceOrderFinancial'
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
  const includeFinancial =
    auth.session.isPlatformAdmin ||
    hasPermission(auth.session.permissions, 'orders.financial.view')
  const { data, error } = await fetchServiceOrderDetail(companyId, id, {
    includeFinancial,
  })

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
    .select('id, company_id, quote_id, status')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 })
  }
  if (!order) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  const includeFinancial =
    auth.session.isPlatformAdmin ||
    hasPermission(auth.session.permissions, 'orders.financial.view')

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.notes === 'string') update.notes = body.notes

  let statusChanged = false
  if (body.status && body.status !== order.status) {
    if (!isValidServiceOrderTransition(order.status, body.status)) {
      return Response.json(
        { error: `Transição de status inválida: ${order.status} → ${body.status}.` },
        { status: 400 },
      )
    }

    if (serviceOrderStatusRequiresReason(body.status) && !body.cancel_reason?.trim()) {
      return Response.json({ error: 'Informe o motivo do cancelamento.' }, { status: 400 })
    }

    update.status = body.status
    statusChanged = true
    if (body.status === 'completed') update.completed_at = new Date().toISOString()
  }

  let financeCoordination: Record<string, unknown> | null = null
  let updated: Record<string, unknown> | null = null

  if (statusChanged && body.status === 'cancelled') {
    // One database transaction owns the critical cancellation effects: cancel OS,
    // release agenda/checkout holds, revoke payment links and create the invoice
    // cancellation. Captured money is never erased; it becomes pending_refund.
    const { data: coordinated, error: cancellationError } = await db.rpc(
      'cancel_service_order_with_finance',
      {
        p_company_id: companyId,
        p_service_order_id: id,
        p_reason: body.cancel_reason?.trim() || '',
        p_actor_user_id: auth.session.userId,
        p_notes: typeof body.notes === 'string' ? body.notes : null,
      },
    )
    if (cancellationError) {
      const raw = cancellationError.message || ''
      if (raw.includes('service_order_not_found')) {
        return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
      }
      if (raw.includes('service_order_terminal')) {
        return Response.json({ error: 'Ordem de Serviço já está em estado terminal.' }, { status: 409 })
      }
      return Response.json({ error: 'Falha ao coordenar cancelamento financeiro.' }, { status: 500 })
    }
    financeCoordination =
      coordinated && typeof coordinated === 'object' && !Array.isArray(coordinated)
        ? (coordinated as Record<string, unknown>)
        : null

    const { data: cancelledOrder, error: reloadError } = await db
      .from('service_orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()
    if (reloadError || !cancelledOrder) {
      return Response.json({ error: reloadError?.message || 'Falha ao recarregar OS.' }, { status: 500 })
    }
    updated = cancelledOrder as unknown as Record<string, unknown>
  } else {
    const { data: normalUpdate, error: updateError } = await db
      .from('service_orders')
      .update(update)
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }
    updated = (normalUpdate ?? {}) as unknown as Record<string, unknown>
  }

  if (statusChanged) {
    const { error: historyError } = await db
      .from('service_order_status_history')
      .insert({
        company_id: companyId,
        service_order_id: id,
        from_status: order.status,
        to_status: body.status,
        reason: body.cancel_reason?.trim() ?? null,
        changed_by: auth.session.userId,
      })
    if (historyError) {
      console.warn('[Orders] Falha ao gravar service_order_status_history:', historyError.message)
    }

    try {
      await db.from('audit_logs').insert({
        company_id: companyId,
        user_id: auth.session.userId,
        entity_type: 'service_order',
        entity_id: id,
        action: 'update_status',
        old_data: { status: order.status },
        new_data: {
          status: body.status,
          ...(financeCoordination ? { finance_coordination: financeCoordination } : {}),
        },
      })
    } catch (err) {
      console.warn(
        '[Orders] audit_logs indisponível, seguindo sem bloquear:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  const payload = sanitizeServiceOrderListRowForActor(updated ?? {}, { includeFinancial })

  return Response.json({
    data: payload,
    ...(includeFinancial && financeCoordination
      ? { finance: financeCoordination }
      : {}),
  })
}
