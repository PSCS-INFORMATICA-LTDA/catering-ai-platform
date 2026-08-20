import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string; memberId: string }> }

/** Soft-remove (active=false) — preserva histórico. */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireApiPermission('teams.manage')
  if (!auth.ok) return auth.response

  const { id: teamId, memberId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  const { data: row } = await db
    .from('operational_team_members')
    .select('id, person_id, role_key, team_id')
    .eq('id', memberId)
    .eq('team_id', teamId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!row) {
    return Response.json({ error: 'Membro não encontrado.' }, { status: 404 })
  }

  const { error } = await db
    .from('operational_team_members')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    entityType: 'operational_team',
    entityId: teamId,
    action: 'team_member_removed',
    actorUserId: auth.session.userId,
    oldData: {
      person_id: row.person_id,
      role_key: row.role_key,
    },
  })

  return Response.json({ ok: true })
}
