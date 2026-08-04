import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireApiPermission('teams.manage')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: {
    name?: string
    color?: string
    notes?: string | null
    active?: boolean
    company_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) {
      return Response.json({ error: 'Nome da equipe é obrigatório.' }, { status: 400 })
    }
    patch.name = name
  }
  if (typeof body.color === 'string' && body.color.trim()) patch.color = body.color.trim()
  if (body.notes !== undefined) {
    patch.notes =
      typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  }
  if (typeof body.active === 'boolean') patch.active = body.active

  const { data, error } = await getSupabaseServerClient()
    .from('operational_teams')
    .update(patch)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Equipe não encontrada.' }, { status: 404 })
  }
  return Response.json({ data })
}
