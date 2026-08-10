import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  ensureDefaultInventoryLocation,
} from '@/Lib/inventory/postInventory'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('inventory_locations')
    .select('id, name, code, is_default, active, created_at, updated_at')
    .eq('company_id', companyId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('inventory.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: { name?: string; code?: string | null; ensure_default?: boolean }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  if (body.ensure_default) {
    const id = await ensureDefaultInventoryLocation(
      companyId,
      auth.session.userId,
      body.name?.trim() || 'Main Stock',
    )
    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'inventory_location',
      entityId: id,
      action: 'inventory_location_created',
      newData: { ensure_default: true },
    })
    return Response.json({ data: { id } })
  }

  const name = (body.name || '').trim()
  if (!name) {
    return Response.json({ error: 'Nome é obrigatório.' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('inventory_locations')
    .insert({
      company_id: companyId,
      name,
      code: body.code?.trim() || null,
      is_default: false,
      active: true,
      created_by: auth.session.userId,
      updated_by: auth.session.userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message || 'Falha.' }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'inventory_location',
    entityId: data.id,
    action: 'inventory_location_created',
    newData: { name: data.name, code: data.code },
  })

  return Response.json({ data })
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission('inventory.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: { id?: string; name?: string; code?: string | null }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (!body.id) {
    return Response.json({ error: 'id obrigatório.' }, { status: 400 })
  }
  const patch: Record<string, unknown> = { updated_by: auth.session.userId }
  if (body.name != null) {
    const n = body.name.trim()
    if (!n) return Response.json({ error: 'Nome inválido.' }, { status: 400 })
    patch.name = n
  }
  if (body.code !== undefined) patch.code = body.code?.trim() || null

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('inventory_locations')
    .update(patch)
    .eq('id', body.id)
    .eq('company_id', companyId)
    .select('*')
    .single()
  if (error || !data) {
    return Response.json({ error: error?.message || 'Falha.' }, { status: 500 })
  }
  return Response.json({ data })
}
