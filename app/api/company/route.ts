import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
  type ApiAuthResult,
} from '@/Lib/auth/requireApi'
import { formatAddressFromParts, formatCep, normalizeCep } from '@/Lib/cep'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELECT =
  'id, company_name, legal_name, trade_name, document, state_registration, postal_code, street, address_number, address_complement, neighborhood, city, state, address, phone, billing_email, website, logo_url, brand_logo_url, active'

async function requireCompanyEditor(): Promise<ApiAuthResult> {
  const primary = await requireApiPermission('company.settings')
  if (primary.ok) return primary
  return requireApiPermission('users.manage')
}

export async function GET() {
  const auth = await requireCompanyEditor()
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await getSupabaseServerClient()
    .from('companies')
    .select(SELECT)
    .eq('id', companyId)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }
  return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const auth = await requireCompanyEditor()
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  const trim = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : null

  const companyName =
    trim(body.company_name) || trim(body.legal_name) || trim(body.trade_name)
  if (!companyName) {
    return Response.json(
      { error: 'Informe o nome da empresa (razão ou fantasia).' },
      { status: 400 },
    )
  }

  const postal = trim(body.postal_code)
  const street = trim(body.street) ?? ''
  const number = trim(body.address_number) ?? ''
  const neighborhood = trim(body.neighborhood) ?? ''
  const city = trim(body.city) ?? ''
  const state = trim(body.state) ?? ''
  const address =
    trim(body.address) ||
    formatAddressFromParts({
      street,
      address_number: number,
      neighborhood,
      city,
      state,
      postal_code: postal ? formatCep(postal) : '',
    }) ||
    null

  const patch = {
    company_name: companyName,
    legal_name: trim(body.legal_name) || companyName,
    trade_name: trim(body.trade_name),
    document: trim(body.document),
    state_registration: trim(body.state_registration),
    postal_code: postal ? formatCep(normalizeCep(postal)) : null,
    street: street || null,
    address_number: number || null,
    address_complement: trim(body.address_complement),
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    address,
    phone: trim(body.phone),
    billing_email: trim(body.billing_email),
    website: trim(body.website),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabaseServerClient()
    .from('companies')
    .update(patch)
    .eq('id', companyId)
    .select(SELECT)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ data })
}
