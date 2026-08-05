import {
  getCustomerDisplayName,
  type CustomerNameSource,
} from '@/Lib/getCustomerDisplayName'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type ServiceOrderListItem = {
  id: string
  service_order_number: string
  quote_id: string
  quote_number: string | null
  customer_name: string
  status: string
  event_date: string | null
  city: string | null
  state: string | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  service_order_total: number
  currency_code: string
  created_at: string
}

type ServiceOrderListRow = {
  id: string
  service_order_number: string
  quote_id: string
  customer_id: string | null
  status: string
  event_date: string | null
  city: string | null
  state: string | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  service_order_total: number | null
  currency_code: string | null
  created_at: string
}

const SERVICE_ORDER_LIST_SELECT =
  'id, company_id, service_order_number, quote_id, customer_id, status, event_date, city, state, physical_guest_count, billable_guest_count, service_order_total, currency_code, created_at'

export async function fetchServiceOrderList(
  companyId: string,
): Promise<{ data: ServiceOrderListItem[] | null; error: { message: string } | null }> {
  const supabase = getSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_LIST_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: { message: error.message } }

  const list = (rows ?? []) as unknown as ServiceOrderListRow[]
  if (list.length === 0) return { data: [], error: null }

  const quoteIds = [...new Set(list.map((row) => row.quote_id).filter(Boolean))]
  const customerIds = [
    ...new Set(list.map((row) => row.customer_id).filter(Boolean) as string[]),
  ]

  const [quotesRes, customersRes] = await Promise.all([
    quoteIds.length > 0
      ? supabase.from('quotes').select('id, quote_number').in('id', quoteIds)
      : Promise.resolve({ data: [] as Array<{ id: string; quote_number: string | null }> }),
    customerIds.length > 0
      ? supabase
          .from('customers')
          .select('id, ab_name, full_name, contact_name, company_name')
          .in('id', customerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const quoteMap = new Map(
    (quotesRes.data ?? []).map((q) => [q.id as string, q.quote_number as string | null]),
  )
  const customerMap = new Map(
    (customersRes.data ?? []).map((c) => [c.id as string, c]),
  )

  const data: ServiceOrderListItem[] = list.map((row) => {
    const customer = row.customer_id ? customerMap.get(row.customer_id) : undefined
    return {
      id: row.id,
      service_order_number: row.service_order_number,
      quote_id: row.quote_id,
      quote_number: row.quote_id ? quoteMap.get(row.quote_id) ?? null : null,
      customer_name: customer
        ? getCustomerDisplayName(customer as CustomerNameSource)
        : '—',
      status: row.status,
      event_date: row.event_date,
      city: row.city,
      state: row.state,
      physical_guest_count: row.physical_guest_count,
      billable_guest_count: row.billable_guest_count,
      service_order_total: Number(row.service_order_total ?? 0),
      currency_code: row.currency_code ?? 'USD',
      created_at: row.created_at,
    }
  })

  return { data, error: null }
}
