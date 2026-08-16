import { getCdlCompanyId } from './cdlCompany'
import { buildCustomersListSelect } from './customersTableSchema'
import {
  dedupeCustomersList,
  sortCustomersByRecency,
  type CustomerSearchRecord,
} from './searchCustomers'
import { getSupabaseServerClient } from './supabaseServer'

export type CustomerListItem = CustomerSearchRecord & { id: string }

export async function fetchActiveCustomers() {
  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return {
      data: [] as CustomerListItem[],
      error: { message: 'company_id não configurado.' },
    }
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('customers')
    .select(buildCustomersListSelect())
    .eq('company_id', companyId)
    .eq('active', true)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })

  if (error) {
    return { data: null as CustomerListItem[] | null, error }
  }

  return {
    data: dedupeCustomersList(
      sortCustomersByRecency((data ?? []) as unknown as CustomerListItem[]),
    ),
    error: null,
  }
}

export async function fetchAllCustomers() {
  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return {
      data: [] as CustomerListItem[],
      error: { message: 'company_id não configurado.' },
    }
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('customers')
    .select(buildCustomersListSelect())
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })

  if (error) {
    return { data: null as CustomerListItem[] | null, error }
  }

  return {
    data: dedupeCustomersList(
      sortCustomersByRecency((data ?? []) as unknown as CustomerListItem[]),
    ),
    error: null,
  }
}
