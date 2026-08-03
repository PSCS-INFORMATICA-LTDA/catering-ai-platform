import { getCdlCompanyId } from './cdlCompany'
import {
  buildCustomersListSelect,
  pickCustomersInsertPayload,
  type CustomersInsertPayload,
} from './customersTableSchema'
import {
  CUSTOMER_DISPLAY_NAME_EMPTY,
  getCustomerDisplayName,
} from './getCustomerDisplayName'
import { getNextAbNumber } from './getNextDocumentNumber'
import { isUsablePhone, normalizePhone } from './normalizePhone'
import { getSupabaseServerClient } from './supabaseServer'

export type CustomerRecord = {
  id: string
  phone?: string | null
  phone_normalized?: string | null
  email?: string | null
  full_name?: string | null
  contact_name?: string | null
  company_name?: string | null
  ab_name?: string | null
  ab_number?: string | null
  active?: boolean | null
  company_id?: string | null
}

export type FindOrCreateCustomerInput = {
  phone: string
  name?: string | null
  email?: string | null
}

export type FindOrCreateCustomerResult = {
  customer: CustomerRecord | null
  created: boolean
  error: { message: string } | null
}

const UNIQUE_VIOLATION = '23505'

function resolveAbName(input: FindOrCreateCustomerInput): string {
  const name = input.name?.trim()
  if (name) return name
  return input.phone.trim()
}

async function buildInsertRow(
  input: FindOrCreateCustomerInput,
  companyId: string,
  phoneNormalized: string,
): Promise<CustomersInsertPayload> {
  const { number: abNumber, error: numberError } =
    await getNextAbNumber(companyId)

  if (numberError || !abNumber) {
    console.warn(
      '[CDL Customer] ab_number indisponível; criando cliente sem AB Number:',
      numberError?.message ?? 'RPC retornou vazio',
    )
  }

  const name = input.name?.trim() || null
  const email = input.email?.trim() || null
  const phone = input.phone.trim()
  const abName = resolveAbName(input)

  const row: CustomersInsertPayload = {
    phone,
    phone_normalized: phoneNormalized,
    email,
    company_id: companyId,
    active: true,
    ab_name: abName,
    ...(abNumber ? { ab_number: abNumber } : {}),
  }

  if (name) {
    row.contact_name = name
    row.full_name = name
  }

  return row
}

async function findActiveCustomerByPhoneNormalized(
  companyId: string,
  phoneNormalized: string,
): Promise<CustomerRecord | null> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('customers')
    .select(buildCustomersListSelect())
    .eq('company_id', companyId)
    .eq('active', true)
    .eq('phone_normalized', phoneNormalized)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn(
      '[CDL Customer] lookup by phone_normalized failed:',
      error.message,
    )
    return null
  }

  return (data as CustomerRecord | null) ?? null
}

async function findActiveCustomerByPhoneFallback(
  companyId: string,
  phoneNormalized: string,
): Promise<CustomerRecord | null> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('customers')
    .select(buildCustomersListSelect())
    .eq('company_id', companyId)
    .eq('active', true)

  if (error) {
    return null
  }

  const rows = (data ?? []) as unknown as CustomerRecord[]
  return (
    rows.find((row) => {
      const stored =
        row.phone_normalized?.trim() || normalizePhone(row.phone)
      if (!stored) return false
      if (stored === phoneNormalized) return true
      if (stored.length >= 10 && phoneNormalized.length >= 10) {
        return stored.slice(-10) === phoneNormalized.slice(-10)
      }
      return false
    }) ?? null
  )
}

export async function findOrCreateCustomerByPhone(
  input: FindOrCreateCustomerInput,
): Promise<FindOrCreateCustomerResult> {
  const phoneNormalized = normalizePhone(input.phone)
  if (!isUsablePhone(input.phone)) {
    return {
      customer: null,
      created: false,
      error: { message: 'Telefone inválido (mínimo 10 dígitos).' },
    }
  }

  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return {
      customer: null,
      created: false,
      error: { message: 'company_id não configurado.' },
    }
  }

  let existing =
    (await findActiveCustomerByPhoneNormalized(companyId, phoneNormalized)) ??
    (await findActiveCustomerByPhoneFallback(companyId, phoneNormalized))

  if (existing) {
    return { customer: existing, created: false, error: null }
  }

  const insertRow = pickCustomersInsertPayload(
    await buildInsertRow(input, companyId, phoneNormalized),
  )

  const supabase = getSupabaseServerClient()
  const { data: created, error: insertError } = await supabase
    .from('customers')
    .insert(insertRow)
    .select(buildCustomersListSelect())
    .single()

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      existing =
        (await findActiveCustomerByPhoneNormalized(companyId, phoneNormalized)) ??
        (await findActiveCustomerByPhoneFallback(companyId, phoneNormalized))

      if (existing) {
        return { customer: existing, created: false, error: null }
      }
    }

    return {
      customer: null,
      created: false,
      error: {
        message:
          insertError.message ??
          'Não foi possível criar cliente automaticamente.',
      },
    }
  }

  if (!created) {
    return {
      customer: null,
      created: false,
      error: { message: 'Não foi possível criar cliente automaticamente.' },
    }
  }

  const customer = created as unknown as CustomerRecord
  if (
    getCustomerDisplayName(customer) === CUSTOMER_DISPLAY_NAME_EMPTY &&
    insertRow.ab_name
  ) {
    customer.ab_name = insertRow.ab_name as string
  }

  return { customer, created: true, error: null }
}
