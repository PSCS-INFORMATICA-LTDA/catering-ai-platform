import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { sanitizeInternalNotes } from '@/Lib/commercialReview/internalNotes'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const body = (await request.json().catch(() => ({}))) as { notes?: unknown }
  const notes = sanitizeInternalNotes(body.notes)

  const db = getSupabaseServerClient()
  const { data: quote, error: loadError } = await db
    .from('quotes')
    .select('id, company_id, internal_notes')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (loadError) {
    if (/internal_notes|column/i.test(loadError.message)) {
      return Response.json(
        { error: 'internal_notes_unavailable', code: 'migration_required' },
        { status: 409 },
      )
    }
    return Response.json({ error: loadError.message }, { status: 500 })
  }
  if (!quote) {
    return Response.json({ error: 'Cotação não encontrada' }, { status: 404 })
  }

  const { data, error } = await db
    .from('quotes')
    .update({ internal_notes: notes || null })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id, internal_notes')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.appUser?.id || auth.session.userId || null,
    entityType: 'quote',
    entityId: id,
    action: 'internal_notes_updated',
    oldData: { has_notes: Boolean(quote.internal_notes) },
    newData: { quote_id: id, has_notes: Boolean(notes) },
  })

  return Response.json({ data: { notes: data.internal_notes ?? '' } })
}
