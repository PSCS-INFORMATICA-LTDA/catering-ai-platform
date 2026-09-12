import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type EventCloseoutLineType =
  | 'guest_overage'
  | 'extra_service'
  | 'overtime'
  | 'equipment'
  | 'damage'
  | 'other'

export type EventCloseoutExtraServiceInput = {
  line_type: Exclude<EventCloseoutLineType, 'guest_overage'>
  description: string
  quantity: number
  unit_price: number
}

export type EventFinancialCloseoutLine = {
  id: string
  line_type: EventCloseoutLineType
  source_ref: string | null
  description: string
  quantity: number
  unit_price: number
  amount: number
  created_at: string
}

export type EventFinancialCloseoutView = {
  id: string | null
  status: 'not_started' | 'draft' | 'ready_for_review' | 'closed_no_charge' | 'invoiced' | 'void'
  service_order_id: string
  service_order_number: string
  service_order_status: string
  quote_id: string
  currency_code: string
  original_invoice: {
    id: string
    invoice_number: string
    status: string
    total: number
    paid_total: number
  } | null
  supplemental_invoice: {
    id: string
    invoice_number: string
    status: string
    total: number
    paid_total: number
  } | null
  contracted: {
    adults: number
    children_under_3: number
    children_4_to_12: number
    physical_guests: number
    billable_guests: number
  }
  final: {
    adults: number | null
    children_under_3: number | null
    children_4_to_12: number | null
    physical_guests: number | null
    billable_guests: number | null
  }
  billable_guest_overage: number
  guest_overage_total: number
  extra_services_total: number
  adjustment_total: number
  final_event_total: number
  notes: string | null
  finalized_at: string | null
  lines: EventFinancialCloseoutLine[]
}

function money(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function integer(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0
}

function rpcError(message: string | null | undefined) {
  const raw = message || 'financial_closeout_failed'
  const known = [
    'service_order_not_found',
    'original_invoice_not_found',
    'original_invoice_canceled',
    'invalid_final_guest_counts',
    'invalid_extra_services',
    'too_many_extra_services',
    'extra_service_description_required',
    'extra_service_quantity_invalid',
    'extra_service_unit_price_invalid',
    'extra_service_type_invalid',
    'guest_overage_pricing_missing',
    'closeout_finalized',
    'closeout_not_found',
    'closeout_not_ready',
    'service_order_must_be_completed',
    'actor_required',
  ]
  return known.find((code) => raw.includes(code)) || raw
}

export function financialCloseoutErrorStatus(code: string) {
  if (code === 'service_order_not_found' || code === 'original_invoice_not_found' || code === 'closeout_not_found') return 404
  if (
    code === 'invalid_final_guest_counts' ||
    code === 'invalid_extra_services' ||
    code === 'too_many_extra_services' ||
    code === 'extra_service_description_required' ||
    code === 'extra_service_quantity_invalid' ||
    code === 'extra_service_unit_price_invalid' ||
    code === 'extra_service_type_invalid'
  ) return 400
  if (
    code === 'closeout_finalized' ||
    code === 'closeout_not_ready' ||
    code === 'service_order_must_be_completed' ||
    code === 'guest_overage_pricing_missing' ||
    code === 'original_invoice_canceled'
  ) return 409
  return 500
}

function guestSnapshot(value: unknown) {
  const snapshot = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const guests = snapshot.guest_counts && typeof snapshot.guest_counts === 'object'
    ? (snapshot.guest_counts as Record<string, unknown>)
    : {}
  return {
    adults: integer(guests.adult_count),
    children_under_3: integer(guests.children_under_3_count),
    children_4_to_12: integer(guests.children_4_to_12_count),
    physical_guests: integer(guests.physical_guest_count),
    billable_guests: money(guests.billable_guest_count),
  }
}

export async function loadEventFinancialCloseout(
  companyId: string,
  serviceOrderId: string,
): Promise<{ ok: true; data: EventFinancialCloseoutView } | { ok: false; status: number; error: string }> {
  const db = getSupabaseServerClient()
  const { data: order, error: orderError } = await db
    .from('service_orders')
    .select('id, company_id, service_order_number, status, quote_id, currency_code, physical_guest_count, billable_guest_count, commercial_snapshot')
    .eq('company_id', companyId)
    .eq('id', serviceOrderId)
    .maybeSingle()

  if (orderError) return { ok: false, status: 500, error: orderError.message }
  if (!order) return { ok: false, status: 404, error: 'service_order_not_found' }

  const { data: originalInvoice, error: invoiceError } = await db
    .from('invoices')
    .select('id, invoice_number, status, total, paid_total, currency_code')
    .eq('company_id', companyId)
    .eq('quote_id', order.quote_id)
    .eq('invoice_kind', 'original')
    .neq('status', 'canceled')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (invoiceError) return { ok: false, status: 500, error: invoiceError.message }

  const baseline = guestSnapshot(order.commercial_snapshot)
  if (baseline.physical_guests === 0) baseline.physical_guests = integer(order.physical_guest_count)
  if (baseline.billable_guests === 0) baseline.billable_guests = money(order.billable_guest_count)

  const { data: closeout, error: closeoutError } = await db
    .from('event_financial_closeouts')
    .select('*')
    .eq('company_id', companyId)
    .eq('service_order_id', serviceOrderId)
    .maybeSingle()

  if (closeoutError) return { ok: false, status: 500, error: closeoutError.message }

  let lines: EventFinancialCloseoutLine[] = []
  let supplementalInvoice: EventFinancialCloseoutView['supplemental_invoice'] = null

  if (closeout) {
    const [lineResult, supplementalResult] = await Promise.all([
      db
        .from('event_financial_closeout_lines')
        .select('id, line_type, source_ref, description, quantity, unit_price, amount, created_at')
        .eq('company_id', companyId)
        .eq('closeout_id', closeout.id)
        .order('created_at', { ascending: true }),
      closeout.supplemental_invoice_id
        ? db
            .from('invoices')
            .select('id, invoice_number, status, total, paid_total')
            .eq('company_id', companyId)
            .eq('id', closeout.supplemental_invoice_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (lineResult.error) return { ok: false, status: 500, error: lineResult.error.message }
    if (supplementalResult.error) return { ok: false, status: 500, error: supplementalResult.error.message }

    lines = (lineResult.data ?? []).map((line) => ({
      id: String(line.id),
      line_type: line.line_type as EventCloseoutLineType,
      source_ref: line.source_ref ?? null,
      description: String(line.description),
      quantity: Number(line.quantity),
      unit_price: money(line.unit_price),
      amount: money(line.amount),
      created_at: String(line.created_at),
    }))
    if (supplementalResult.data) {
      supplementalInvoice = {
        id: String(supplementalResult.data.id),
        invoice_number: String(supplementalResult.data.invoice_number),
        status: String(supplementalResult.data.status),
        total: money(supplementalResult.data.total),
        paid_total: money(supplementalResult.data.paid_total),
      }
    }
  }

  const original = originalInvoice
    ? {
        id: String(originalInvoice.id),
        invoice_number: String(originalInvoice.invoice_number),
        status: String(originalInvoice.status),
        total: money(originalInvoice.total),
        paid_total: money(originalInvoice.paid_total),
      }
    : null
  const adjustmentTotal = money(closeout?.adjustment_total)

  return {
    ok: true,
    data: {
      id: closeout?.id ? String(closeout.id) : null,
      status: (closeout?.status || 'not_started') as EventFinancialCloseoutView['status'],
      service_order_id: String(order.id),
      service_order_number: String(order.service_order_number),
      service_order_status: String(order.status),
      quote_id: String(order.quote_id),
      currency_code: String(closeout?.currency_code || originalInvoice?.currency_code || order.currency_code || 'USD'),
      original_invoice: original,
      supplemental_invoice: supplementalInvoice,
      contracted: closeout
        ? {
            adults: integer(closeout.contracted_adults),
            children_under_3: integer(closeout.contracted_children_under_3),
            children_4_to_12: integer(closeout.contracted_children_4_to_12),
            physical_guests: integer(closeout.contracted_physical_guests),
            billable_guests: money(closeout.contracted_billable_guests),
          }
        : baseline,
      final: {
        adults: closeout?.final_adults == null ? null : integer(closeout.final_adults),
        children_under_3: closeout?.final_children_under_3 == null ? null : integer(closeout.final_children_under_3),
        children_4_to_12: closeout?.final_children_4_to_12 == null ? null : integer(closeout.final_children_4_to_12),
        physical_guests: closeout?.final_physical_guests == null ? null : integer(closeout.final_physical_guests),
        billable_guests: closeout?.final_billable_guests == null ? null : money(closeout.final_billable_guests),
      },
      billable_guest_overage: money(closeout?.billable_guest_overage),
      guest_overage_total: money(closeout?.guest_overage_total),
      extra_services_total: money(closeout?.extra_services_total),
      adjustment_total: adjustmentTotal,
      final_event_total: money((original?.total || 0) + adjustmentTotal),
      notes: closeout?.notes ?? null,
      finalized_at: closeout?.finalized_at ?? null,
      lines,
    },
  }
}

export async function saveEventFinancialCloseout(input: {
  companyId: string
  serviceOrderId: string
  finalAdults: number
  finalChildrenUnder3: number
  finalChildren4To12: number
  extraServices: EventCloseoutExtraServiceInput[]
  notes?: string | null
  actorUserId: string
}) {
  const db = getSupabaseServerClient()
  const { error } = await db.rpc('save_event_financial_closeout', {
    p_company_id: input.companyId,
    p_service_order_id: input.serviceOrderId,
    p_final_adults: input.finalAdults,
    p_final_children_under_3: input.finalChildrenUnder3,
    p_final_children_4_to_12: input.finalChildren4To12,
    p_extra_services: input.extraServices,
    p_notes: input.notes?.trim() || null,
    p_actor_user_id: input.actorUserId,
  })
  if (error) {
    const code = rpcError(error.message)
    return { ok: false as const, status: financialCloseoutErrorStatus(code), error: code }
  }
  return loadEventFinancialCloseout(input.companyId, input.serviceOrderId)
}

export async function finalizeEventFinancialCloseout(input: {
  companyId: string
  serviceOrderId: string
  actorUserId: string
}) {
  const db = getSupabaseServerClient()
  const { error } = await db.rpc('finalize_event_financial_closeout', {
    p_company_id: input.companyId,
    p_service_order_id: input.serviceOrderId,
    p_actor_user_id: input.actorUserId,
  })
  if (error) {
    const code = rpcError(error.message)
    return { ok: false as const, status: financialCloseoutErrorStatus(code), error: code }
  }
  return loadEventFinancialCloseout(input.companyId, input.serviceOrderId)
}
