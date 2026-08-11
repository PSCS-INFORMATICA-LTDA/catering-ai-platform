import { requireApiPermission } from '@/Lib/auth/requireApi'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import {
  buildCustomersListSelect,
  pickCustomersUpdatePayload,
  type CustomersUpdatePayload,
} from '@/Lib/customersTableSchema'
import { assertCustomerCanBeDeactivated } from '@/Lib/customerOpenQuotes'
import { isUsablePhone, normalizePhone } from '@/Lib/normalizePhone'
import { supabase } from '@/Lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('customers.manage')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const companyId = getCdlCompanyId()

  if (!companyId?.trim()) {
    return Response.json({ error: 'company_id não configurado.' }, { status: 500 })
  }

  let body: CustomersUpdatePayload
  try {
    body = (await request.json()) as CustomersUpdatePayload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const isDeactivateOnly =
    Object.keys(body).length === 1 && body.active === false

  if (isDeactivateOnly) {
    const guard = await assertCustomerCanBeDeactivated(id)
    if (!guard.allowed) {
      return Response.json(
        {
          error: guard.message ?? 'Cliente possui cotações em aberto.',
          openQuoteCount: guard.count,
        },
        { status: 409 },
      )
    }
  }

  const updatePayload: Record<string, string | boolean | null> = isDeactivateOnly
    ? { active: false, updated_at: new Date().toISOString() }
    : {
        ...pickCustomersUpdatePayload(body),
        updated_at: new Date().toISOString(),
      }

  if (!isDeactivateOnly && body.phone !== undefined) {
    const phone = String(body.phone ?? '').trim()
    if (!isUsablePhone(phone)) {
      return Response.json(
        { error: 'Telefone inválido. Informe o DDI (ex.: +5511983481803).' },
        { status: 400 },
      )
    }
    updatePayload.phone = phone
    updatePayload.phone_normalized = normalizePhone(phone)
  }

  const { data, error } = await supabase
    .from('customers')
    .update(updatePayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(buildCustomersListSelect())
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return Response.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  return Response.json({ data })
}
