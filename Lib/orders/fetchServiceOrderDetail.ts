import {
  getCustomerDisplayName,
  type CustomerNameSource,
} from '@/Lib/getCustomerDisplayName'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type ServiceOrderDetail = {
  id: string
  company_id: string
  service_order_number: string
  quote_id: string
  quote_number: string | null
  quote_version_id: string
  event_id: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  status: string
  event_date: string | null
  start_time: string | null
  end_time: string | null
  venue_name: string | null
  address_line: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  currency_code: string
  package_total: number
  additional_total: number
  mileage_fee: number
  discount_amount: number
  reservation_amount: number
  balance_due: number
  service_order_total: number
  commercial_snapshot: Record<string, unknown>
  notes: string | null
  cancel_reason: string | null
  cancelled_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  items: Array<{
    id: string
    item_type: string
    item_key: string | null
    label_pt: string
    quantity: number | null
    unit_price: number | null
    total_price: number | null
    display_order: number
  }>
  checklist: Array<{
    id: string
    title: string
    category: string
    is_required: boolean
    status: string
    display_order: number
    completed_by: string | null
    completed_at: string | null
  }>
  status_history: Array<{
    id: string
    from_status: string | null
    to_status: string
    reason: string | null
    changed_by: string | null
    created_at: string
  }>
  agenda_event: {
    id: string
    team_id: string | null
    event_date: string
    start_time: string
    end_time: string
    status: string
  } | null
}

export async function fetchServiceOrderDetail(
  companyId: string,
  serviceOrderId: string,
): Promise<{ data: ServiceOrderDetail | null; error: { message: string; status?: number } | null }> {
  const supabase = getSupabaseServerClient()

  const { data: order, error } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', serviceOrderId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return { data: null, error: { message: error.message, status: 500 } }
  if (!order) return { data: null, error: { message: 'Ordem de Serviço não encontrada.', status: 404 } }

  const [quoteRes, customerRes, itemsRes, checklistRes, historyRes, agendaRes] =
    await Promise.all([
      supabase.from('quotes').select('quote_number').eq('id', order.quote_id).maybeSingle(),
      order.customer_id
        ? supabase
            .from('customers')
            .select('ab_name, full_name, contact_name, company_name, phone, email')
            .eq('id', order.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('service_order_items')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .order('display_order', { ascending: true }),
      supabase
        .from('service_order_checklist_items')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .order('display_order', { ascending: true }),
      supabase
        .from('service_order_status_history')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .order('created_at', { ascending: false }),
      supabase
        .from('agenda_events')
        .select('id, team_id, event_date, start_time, end_time, status')
        .eq('service_order_id', serviceOrderId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const customer = customerRes.data as CustomerNameSource | null

  const data: ServiceOrderDetail = {
    id: order.id,
    company_id: order.company_id,
    service_order_number: order.service_order_number,
    quote_id: order.quote_id,
    quote_number: (quoteRes.data?.quote_number as string | null) ?? null,
    quote_version_id: order.quote_version_id,
    event_id: order.event_id,
    customer_id: order.customer_id,
    customer_name: getCustomerDisplayName(customer),
    customer_phone: customer?.phone ?? null,
    customer_email: customer?.email ?? null,
    status: order.status,
    event_date: order.event_date,
    start_time: order.start_time,
    end_time: order.end_time,
    venue_name: order.venue_name,
    address_line: order.address_line,
    city: order.city,
    state: order.state,
    postal_code: order.postal_code,
    physical_guest_count: order.physical_guest_count,
    billable_guest_count: order.billable_guest_count,
    currency_code: order.currency_code,
    package_total: Number(order.package_total ?? 0),
    additional_total: Number(order.additional_total ?? 0),
    mileage_fee: Number(order.mileage_fee ?? 0),
    discount_amount: Number(order.discount_amount ?? 0),
    reservation_amount: Number(order.reservation_amount ?? 0),
    balance_due: Number(order.balance_due ?? 0),
    service_order_total: Number(order.service_order_total ?? 0),
    commercial_snapshot: order.commercial_snapshot ?? {},
    notes: order.notes,
    cancel_reason: order.cancel_reason,
    cancelled_at: order.cancelled_at,
    completed_at: order.completed_at,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: itemsRes.data ?? [],
    checklist: checklistRes.data ?? [],
    status_history: historyRes.data ?? [],
    agenda_event: agendaRes.data ?? null,
  }

  return { data, error: null }
}
