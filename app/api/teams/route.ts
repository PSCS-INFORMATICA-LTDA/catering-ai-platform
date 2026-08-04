import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireApiPermission('teams.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const activeOnly = url.searchParams.get('active') !== 'all'

  let query = getSupabaseServerClient()
    .from('operational_teams')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(
    { data: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('teams.manage')
  if (!auth.ok) return auth.response

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

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return Response.json({ error: 'Nome da equipe é obrigatório.' }, { status: 400 })
  }

  const { data, error } = await getSupabaseServerClient()
    .from('operational_teams')
    .insert({
      company_id: companyId,
      name,
      color:
        typeof body.color === 'string' && body.color.trim()
          ? body.color.trim()
          : '#e21b1b',
      notes:
        typeof body.notes === 'string' && body.notes.trim()
          ? body.notes.trim()
          : null,
      active: body.active !== false,
    })
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ data }, { status: 201 })
}
