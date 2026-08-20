import { getCdlCompanyId } from './cdlCompany'
import { getSupabaseServerClient } from './supabaseServer'

export const OPEN_QUOTE_STATUSES = [
  'draft',
  'open',
  'sent',
  'pending',
  'approved',
  'accepted',
] as const

export const CLOSED_QUOTE_STATUSES = [
  'cancelled',
  'rejected',
  'completed',
  'closed',
  'inactive',
] as const

export type OpenQuoteCountMap = Record<string, number>

export async function countOpenQuotesForCustomer(
  customerId: string,
): Promise<{ count: number; error: { message: string } | null }> {
  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return { count: 0, error: { message: 'company_id não configurado.' } }
  }

  const supabase = getSupabaseServerClient()
  const { count, error } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('active', true)
    .in('quote_status', [...OPEN_QUOTE_STATUSES])

  if (error) {
    return { count: 0, error: { message: error.message } }
  }

  return { count: count ?? 0, error: null }
}

export async function countOpenQuotesForCustomers(
  customerIds: string[],
): Promise<{ counts: OpenQuoteCountMap; error: { message: string } | null }> {
  const counts: OpenQuoteCountMap = {}
  if (customerIds.length === 0) {
    return { counts, error: null }
  }

  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return { counts, error: { message: 'company_id não configurado.' } }
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('quotes')
    .select('customer_id')
    .eq('company_id', companyId)
    .eq('active', true)
    .in('customer_id', customerIds)
    .in('quote_status', [...OPEN_QUOTE_STATUSES])

  if (error) {
    return { counts, error: { message: error.message } }
  }

  for (const row of data ?? []) {
    const id = String((row as { customer_id?: string }).customer_id ?? '')
    if (!id) continue
    counts[id] = (counts[id] ?? 0) + 1
  }

  return { counts, error: null }
}

export async function assertCustomerCanBeDeactivated(
  customerId: string,
): Promise<{ allowed: boolean; count: number; message: string | null }> {
  const { count, error } = await countOpenQuotesForCustomer(customerId)

  if (error) {
    return {
      allowed: false,
      count: 0,
      message: error.message,
    }
  }

  if (count > 0) {
    const suffix = count === 1 ? 'cotação em aberto' : 'cotações em aberto'
    return {
      allowed: false,
      count,
      message: `Não é possível excluir este cadastro porque existem ${count} ${suffix} vinculadas a ele.`,
    }
  }

  return { allowed: true, count: 0, message: null }
}
