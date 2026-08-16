import { getCdlCompanyId } from './cdlCompany'
import { buildCustomersListSelect } from './customersTableSchema'
import type { CustomerRecord } from './findOrCreateCustomerByPhone'
import { isUsablePhone, normalizePhone } from './normalizePhone'
import { supabase } from './supabase'

export type LookupCustomerResult = {
  customer: CustomerRecord | null
  error: { message: string } | null
}

async function findActiveCustomerByPhoneNormalized(
  companyId: string,
  phoneNormalized: string,
): Promise<CustomerRecord | null> {
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
      '[Customer lookup] phone_normalized query failed:',
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
  const { data, error } = await supabase
    .from('customers')
    .select(buildCustomersListSelect())
    .eq('company_id', companyId)
    .eq('active', true)

  if (error) return null

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

/** Busca cliente ativo por telefone — nunca cria registro. */
export async function lookupCustomerByPhone(
  phone: string,
): Promise<LookupCustomerResult> {
  const phoneNormalized = normalizePhone(phone)
  if (!isUsablePhone(phone)) {
    return {
      customer: null,
      error: { message: 'Telefone inválido. Informe o DDI (ex.: +5511983481803).' },
    }
  }

  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return {
      customer: null,
      error: { message: 'company_id não configurado.' },
    }
  }

  const customer =
    (await findActiveCustomerByPhoneNormalized(companyId, phoneNormalized)) ??
    (await findActiveCustomerByPhoneFallback(companyId, phoneNormalized))

  return { customer, error: null }
}
