import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

const CHECKLIST_CATEGORIES = [
  'comercial',
  'preparacao',
  'equipe',
  'equipamentos',
  'alimentos',
  'logistica_evento',
  'montagem',
  'execucao',
  'desmontagem',
  'pos_evento',
]

const CHECKLIST_STATUSES = ['pending', 'done', 'skipped']

async function assertOrderInCompany(companyId: string, serviceOrderId: string) {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('service_orders')
    .select('id')
    .eq('id', serviceOrderId)
    .eq('company_id', companyId)
    .maybeSingle()
  return Boolean(data)
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  if (!(await assertOrderInCompany(companyId, id))) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('service_order_checklist_items')
    .select('*')
    .eq('service_order_id', id)
    .order('display_order', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  if (!(await assertOrderInCompany(companyId, id))) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  let body: {
    title?: string
    category?: string
    is_required?: boolean
    display_order?: number
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return Response.json({ error: 'Título é obrigatório.' }, { status: 400 })
  }
  const category = CHECKLIST_CATEGORIES.includes(body.category ?? '')
    ? body.category
    : 'preparacao'

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('service_order_checklist_items')
    .insert({
      company_id: companyId,
      service_order_id: id,
      title,
      category,
      is_required: Boolean(body.is_required),
      display_order: body.display_order ?? 0,
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'checklist_item',
    entityId: data.id,
    action: 'checklist_item_created',
    newData: { service_order_id: id, title, category },
  })

  return Response.json({ data }, { status: 201 })
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  if (!(await assertOrderInCompany(companyId, id))) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  let body: { item_id?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const itemId = body.item_id?.trim()
  if (!itemId || !CHECKLIST_STATUSES.includes(body.status ?? '')) {
    return Response.json(
      { error: 'item_id e status válido são obrigatórios.' },
      { status: 400 },
    )
  }

  const db = getSupabaseServerClient()
  const update: Record<string, unknown> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  }
  if (body.status === 'done') {
    update.completed_by = auth.session.userId
    update.completed_at = new Date().toISOString()
  } else {
    update.completed_by = null
    update.completed_at = null
  }

  const { data, error } = await db
    .from('service_order_checklist_items')
    .update(update)
    .eq('id', itemId)
    .eq('service_order_id', id)
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const auditAction =
    body.status === 'done'
      ? 'checklist_item_completed'
      : body.status === 'skipped'
        ? 'checklist_item_skipped'
        : 'checklist_item_reopened'
  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'checklist_item',
    entityId: itemId,
    action: auditAction,
    newData: { service_order_id: id, status: body.status },
  })

  return Response.json({ data })
}
