import {
  isOperationalRoleKey,
  type OperationalRoleKey,
} from '@/Lib/agenda/operationalRoles'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireApiPermission('teams.view')
  if (!auth.ok) return auth.response

  const { id: teamId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  const { data: team } = await db
    .from('operational_teams')
    .select('id')
    .eq('id', teamId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!team) {
    return Response.json({ error: 'Equipe não encontrada.' }, { status: 404 })
  }

  const { data, error } = await db
    .from('operational_team_members')
    .select(
      'id, team_id, person_id, role_key, active, created_at, updated_at, customers:person_id(id, full_name, ab_name, phone, preferred_language)',
    )
    .eq('company_id', companyId)
    .eq('team_id', teamId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, context: Ctx) {
  const auth = await requireApiPermission('teams.manage')
  if (!auth.ok) return auth.response

  const { id: teamId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: {
    person_id?: string
    role_key?: string
    company_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  const personId = typeof body.person_id === 'string' ? body.person_id : ''
  const roleKey = typeof body.role_key === 'string' ? body.role_key : ''
  if (!personId || !isOperationalRoleKey(roleKey)) {
    return Response.json(
      { error: 'person_id e role_key válidos são obrigatórios.' },
      { status: 400 },
    )
  }

  const db = getSupabaseServerClient()
  const { data: team } = await db
    .from('operational_teams')
    .select('id')
    .eq('id', teamId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!team) {
    return Response.json({ error: 'Equipe não encontrada.' }, { status: 404 })
  }

  const { data: person } = await db
    .from('customers')
    .select('id, company_id, is_supplier')
    .eq('id', personId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!person) {
    return Response.json(
      { error: 'Pessoa inválida ou de outra empresa.' },
      { status: 400 },
    )
  }

  await db.from('customer_operational_roles').upsert(
    {
      company_id: companyId,
      person_id: personId,
      role_key: roleKey as OperationalRoleKey,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,person_id,role_key' },
  )

  const { data, error } = await db
    .from('operational_team_members')
    .upsert(
      {
        company_id: companyId,
        team_id: teamId,
        person_id: personId,
        role_key: roleKey as OperationalRoleKey,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,person_id,role_key' },
    )
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    entityType: 'operational_team',
    entityId: teamId,
    action: 'team_member_added',
    actorUserId: auth.session.userId,
    newData: { person_id: personId, role_key: roleKey },
  })

  return Response.json({ data }, { status: 201 })
}
