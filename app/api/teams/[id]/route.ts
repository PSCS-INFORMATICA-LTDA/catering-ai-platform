import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { hydrateTeamsWithContacts } from '@/Lib/teamContacts'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string }> }

function normalizeLang(value: unknown): 'pt' | 'en' | 'es' {
  const lang =
    typeof value === 'string' ? value.trim().toLowerCase() : 'pt'
  return lang === 'en' || lang === 'es' ? lang : 'pt'
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireApiPermission('teams.manage')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: {
    name?: string
    color?: string
    notes?: string | null
    preferred_language?: string
    contact_person_id?: string | null
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
  if (typeof body.color === 'string' && body.color.trim()) {
    patch.color = body.color.trim()
  }
  if (body.notes !== undefined) {
    patch.notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : null
  }
  if (typeof body.active === 'boolean') patch.active = body.active
  if (typeof body.preferred_language === 'string') {
    patch.preferred_language = normalizeLang(body.preferred_language)
  }

  if (body.contact_person_id !== undefined) {
    const contactPersonId =
      typeof body.contact_person_id === 'string' &&
      body.contact_person_id.trim()
        ? body.contact_person_id.trim()
        : null
    patch.contact_person_id = contactPersonId

    if (contactPersonId) {
      const { data: person } = await getSupabaseServerClient()
        .from('customers')
        .select('id, preferred_language, is_team')
        .eq('id', contactPersonId)
        .eq('company_id', companyId)
        .maybeSingle()
      if (!person) {
        return Response.json(
          { error: 'Pessoa de contato inválida para esta empresa.' },
          { status: 400 },
        )
      }
      if (body.preferred_language === undefined) {
        patch.preferred_language = normalizeLang(person.preferred_language)
      }
      if (!person.is_team) {
        await getSupabaseServerClient()
          .from('customers')
          .update({ is_team: true, updated_at: new Date().toISOString() })
          .eq('id', person.id)
      }
    }
  }

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

  const [hydrated] = await hydrateTeamsWithContacts([data], companyId)
  return Response.json({ data: hydrated })
}
