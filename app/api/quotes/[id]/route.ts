import { requireApiPermission } from '@/Lib/auth/requireApi'
import type { QuoteSaveInput } from '@/Lib/buildQuoteSavePayload'
import { deactivateQuote } from '@/Lib/deactivateQuote'
import { logSaveQuoteError } from '@/Lib/supabaseSaveError'
import { updateQuote } from '@/Lib/updateQuote'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const { data, error } = await deactivateQuote(id)

  if (error || !data?.id) {
    return Response.json(
      { error: error?.message ?? 'Erro ao excluir cotação.' },
      { status: 500 },
    )
  }

  return Response.json({ id: data.id })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: QuoteSaveInput

  try {
    body = (await request.json()) as QuoteSaveInput
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  if (!body.packageId) {
    return Response.json(
      { error: 'Pacote é obrigatório.' },
      { status: 400 },
    )
  }

  const { data, error } = await updateQuote(id, body)

  if (error || !data?.id) {
    if (error) logSaveQuoteError(error)
    return Response.json(
      {
        error: error?.message ?? 'Erro ao atualizar cotação no Supabase.',
        code: error?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
        step: error?.step ?? null,
      },
      { status: 500 },
    )
  }

  return Response.json({ id: data.id })
}
