import { rejectSpoofedCompanyId, requireApiPermission } from '@/Lib/auth/requireApi'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import {
  buildCustomersListSelect,
  pickCustomersInsertPayload,
  type CustomersInsertPayload,
} from '@/Lib/customersTableSchema'
import {
  fetchActiveCustomers,
  fetchAllCustomers,
} from '@/Lib/fetchCustomers'
import { getNextAbNumber } from '@/Lib/getNextDocumentNumber'
import { countOpenQuotesForCustomers } from '@/Lib/customerOpenQuotes'
import {
  formatPostalCode,
  inferCountryFromPostalCode,
  postalCodeSaveError,
} from '@/Lib/cep'
import { isUsablePhone, normalizePhone } from '@/Lib/normalizePhone'
import {
  customerMatchesSearch,
  dedupeCustomersList,
  sortCustomersByRecency,
} from '@/Lib/searchCustomers'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireApiPermission('customers.view')
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const activeParam = url.searchParams.get('active')

  const { data, error } =
    activeParam === 'all'
      ? await fetchAllCustomers()
      : await fetchActiveCustomers()

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? 'Não foi possível buscar clientes.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  const role = url.searchParams.get('role')?.trim().toLowerCase() ?? ''

  let result = dedupeCustomersList(data)
  if (role === 'customer') {
    result = result.filter((row) => row.is_customer !== false)
  } else if (role === 'supplier') {
    result = result.filter((row) => Boolean(row.is_supplier))
  } else if (role === 'team') {
    result = result.filter((row) => Boolean(row.is_team))
  }

  if (query) {
    result = dedupeCustomersList(
      sortCustomersByRecency(
        result.filter((customer) => customerMatchesSearch(customer, query)),
      ),
    )
  }

  const customerIds = result.map((row) => row.id)
  const { counts: openQuoteCounts } = await countOpenQuotesForCustomers(customerIds)

  return Response.json(
    { data: result, openQuoteCounts },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('customers.manage')
  if (!auth.ok) return auth.response

  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return Response.json({ error: 'company_id não configurado.' }, { status: 500 })
  }

  let body: CustomersInsertPayload
  try {
    body = (await request.json()) as CustomersInsertPayload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, (body as { company_id?: string }).company_id)
  if (spoof) return spoof

  const phone =
    typeof body.phone === 'string' ? body.phone.trim() : String(body.phone ?? '').trim()
  const phoneNormalized = normalizePhone(phone)
  if (!isUsablePhone(phone)) {
    return Response.json(
      { error: 'Telefone inválido. Informe o DDI (ex.: +5511983481803).' },
      { status: 400 },
    )
  }

  const postal =
    typeof body.postal_code === 'string' ? body.postal_code.trim() : ''
  const postalError = postalCodeSaveError(postal)
  if (postalError) {
    return Response.json({ error: postalError }, { status: 400 })
  }

  const { number: abNumber } = await getNextAbNumber(companyId)

  const row = pickCustomersInsertPayload({
    ...body,
    company_id: companyId,
    phone,
    phone_normalized: phoneNormalized,
    ...(postal
      ? {
          postal_code: formatPostalCode(postal),
          country: inferCountryFromPostalCode(postal),
        }
      : {}),
    active: body.active !== false,
    ...(abNumber ? { ab_number: abNumber } : {}),
    ab_name:
      (typeof body.ab_name === 'string' ? body.ab_name.trim() : '') ||
      (typeof body.full_name === 'string' ? body.full_name.trim() : '') ||
      (typeof body.contact_name === 'string' ? body.contact_name.trim() : '') ||
      phone,
  })

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('customers')
    .insert(row)
    .select(buildCustomersListSelect())
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('customers')
        .select(buildCustomersListSelect())
        .eq('company_id', companyId)
        .eq('active', true)
        .eq('phone_normalized', phoneNormalized)
        .maybeSingle()

      if (existing) {
        return Response.json({ data: existing, duplicate: true })
      }
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data })
}
