import { generateOrderMaterialsFromBom } from '@/Lib/orders/generateOrderMaterialsFromBom'
import {
  ensureAgendaEventForOrder,
  linkAgendaEventToServiceOrder,
} from '@/Lib/orders/orderScale'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { canConvertQuote } from '@/Lib/quotes/statusMachine'
import { ensureAcceptedQuoteVersion } from '@/Lib/quotes/versions'
import { syncReservedAgendaEventForQuote } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { getNextServiceOrderNumber } from '@/Lib/getNextDocumentNumber'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type ServiceOrderRow = {
  id: string
  company_id: string
  service_order_number: string
  quote_id: string
  quote_version_id: string
  event_id: string | null
  customer_id: string | null
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
  created_at: string
  updated_at: string
}

export type ConvertQuoteResult = {
  data: (ServiceOrderRow & { already_existed: boolean }) | null
  error: { message: string; status?: number } | null
}

type SnapshotEvent = {
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  venue_name?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
} | null

type SnapshotShape = {
  currency_code?: string
  package?: {
    id?: string | null
    total?: number
    label?: string | null
    name?: string | null
    package_name?: string | null
    label_pt?: string | null
  }
  guest_counts?: {
    adult_count?: number
    children_under_3_count?: number
    children_4_to_12_count?: number
    physical_guest_count?: number
    billable_guest_count?: number
  }
  additional_items?: Array<{
    additional_item_id?: string
    quantity?: number
    unit_price?: number
    total_price?: number
    selected?: boolean
    label_pt?: string | null
    item_name?: string | null
  }>
  additional_total?: number
  mileage?: { fee?: number }
  discount_amount?: number
  reservation?: { amount?: number }
  balance_due?: number
  quote_total?: number
  event?: SnapshotEvent
}

async function findExistingServiceOrder(companyId: string, quoteVersionId: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('service_orders')
    .select('*')
    .eq('company_id', companyId)
    .eq('quote_version_id', quoteVersionId)
    .maybeSingle()
  if (error) return { data: null, error: { message: error.message } }
  return { data: data as ServiceOrderRow | null, error: null }
}

async function insertServiceOrderItems(
  companyId: string,
  serviceOrderId: string,
  snapshot: SnapshotShape,
) {
  const supabase = getSupabaseServerClient()
  const rows: Record<string, unknown>[] = []

  if (snapshot.package) {
    const packageLabel =
      snapshot.package.label_pt?.trim() ||
      snapshot.package.label?.trim() ||
      snapshot.package.package_name?.trim() ||
      snapshot.package.name?.trim() ||
      'Pacote'
    rows.push({
      company_id: companyId,
      service_order_id: serviceOrderId,
      item_type: 'package',
      item_key: snapshot.package.id ?? null,
      label_pt: packageLabel,
      quantity: snapshot.guest_counts?.billable_guest_count ?? null,
      total_price: snapshot.package.total ?? 0,
      display_order: 0,
    })
  }

  const additionalItems = snapshot.additional_items ?? []
  additionalItems.forEach((item, index) => {
    const addLabel =
      item.label_pt?.trim() || item.item_name?.trim() || 'Adicional'
    rows.push({
      company_id: companyId,
      service_order_id: serviceOrderId,
      item_type: 'additional',
      item_key: item.additional_item_id ?? null,
      label_pt: addLabel,
      quantity: item.quantity ?? null,
      unit_price: item.unit_price ?? null,
      total_price: item.total_price ?? null,
      display_order: index + 1,
    })
  })

  if (rows.length === 0) return

  const { error } = await supabase.from('service_order_items').insert(rows)
  if (error) {
    console.warn('[Orders] Falha ao gravar service_order_items:', error.message)
  }
}

async function writeStatusHistory(
  companyId: string,
  serviceOrderId: string,
  changedBy: string | null,
) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('service_order_status_history').insert({
    company_id: companyId,
    service_order_id: serviceOrderId,
    from_status: null,
    to_status: 'planned',
    reason: 'Conversão de cotação aceita em Ordem de Serviço.',
    changed_by: changedBy,
  })
  if (error) {
    console.warn('[Orders] Falha ao gravar service_order_status_history:', error.message)
  }
}

async function writeAuditLog(input: {
  companyId: string
  actorUserId: string | null
  serviceOrderId: string
  quoteId: string
}) {
  const supabase = getSupabaseServerClient()
  try {
    const { error } = await supabase.from('audit_logs').insert({
      company_id: input.companyId,
      user_id: input.actorUserId,
      entity_type: 'service_order',
      entity_id: input.serviceOrderId,
      action: 'convert_quote_to_service_order',
      new_data: { quote_id: input.quoteId, service_order_id: input.serviceOrderId },
    })
    if (error) {
      console.warn('[Orders] audit_logs indisponível, seguindo sem bloquear:', error.message)
    }
  } catch (err) {
    console.warn(
      '[Orders] audit_logs indisponível, seguindo sem bloquear:',
      err instanceof Error ? err.message : err,
    )
  }
}

/**
 * Vincula agenda_event existente (sinal) à OS.
 * Se não existir (exceção), cria via sync/fallback e audita.
 */
async function attachAgendaToConvertedOrder(input: {
  companyId: string
  quoteId: string
  serviceOrderId: string
  actorUserId: string | null
  order: {
    id: string
    quote_id?: string | null
    event_date?: string | null
    start_time?: string | null
    end_time?: string | null
    service_order_number?: string | null
  }
}) {
  const db = getSupabaseServerClient()
  await linkAgendaEventToServiceOrder(
    db,
    input.companyId,
    input.quoteId,
    input.serviceOrderId,
  )

  const { data: existing } = await db
    .from('agenda_events')
    .select('id, status, service_order_id')
    .eq('company_id', input.companyId)
    .eq('quote_id', input.quoteId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing?.id) {
    await writeOperationalAudit({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      entityType: 'agenda_event',
      entityId: existing.id,
      action: 'agenda_linked_on_convert',
      newData: {
        quote_id: input.quoteId,
        service_order_id: input.serviceOrderId,
        status: existing.status,
      },
    })
    return
  }

  // Fallback seguro: tentar reservar a partir do evento da cotação, depois linkar.
  await syncReservedAgendaEventForQuote({
    companyId: input.companyId,
    quoteId: input.quoteId,
    actorUserId: input.actorUserId,
    requireConfirmed: false,
  })
  await linkAgendaEventToServiceOrder(
    db,
    input.companyId,
    input.quoteId,
    input.serviceOrderId,
  )

  let { data: afterSync } = await db
    .from('agenda_events')
    .select('id, status')
    .eq('company_id', input.companyId)
    .eq('quote_id', input.quoteId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (!afterSync) {
    const created = await ensureAgendaEventForOrder(
      db,
      input.companyId,
      input.order,
    )
    afterSync = created
      ? { id: created.id, status: created.status }
      : null
  }

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'agenda_event',
    entityId: afterSync?.id ?? input.serviceOrderId,
    action: 'agenda_created_on_convert_fallback',
    newData: {
      quote_id: input.quoteId,
      service_order_id: input.serviceOrderId,
      note: 'Nenhum agenda_event no sinal; criado no convert (exceção).',
    },
  })
}

/**
 * Converte uma cotação aceita em Ordem de Serviço.
 *
 * Idempotente: chamadas repetidas para a mesma cotação/versão retornam a
 * mesma Ordem de Serviço (unique `(company_id, quote_version_id)`).
 */
export async function convertAcceptedQuoteToServiceOrder(input: {
  companyId: string
  quoteId: string
  actorUserId: string | null
}): Promise<ConvertQuoteResult> {
  const { companyId, quoteId, actorUserId } = input
  const supabase = getSupabaseServerClient()

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, proposal_response, active, event_id, customer_id, converted_service_order_id',
    )
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (quoteError) {
    return { data: null, error: { message: quoteError.message, status: 500 } }
  }
  if (!quote) {
    return { data: null, error: { message: 'Cotação não encontrada.', status: 404 } }
  }

  if (quote.converted_service_order_id) {
    const { data: existing, error: existingError } = await supabase
      .from('service_orders')
      .select('*')
      .eq('id', quote.converted_service_order_id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (existingError) {
      return { data: null, error: { message: existingError.message, status: 500 } }
    }
    if (existing) {
      await attachAgendaToConvertedOrder({
        companyId,
        quoteId,
        serviceOrderId: existing.id,
        actorUserId,
        order: existing as ServiceOrderRow,
      })
      return { data: { ...(existing as ServiceOrderRow), already_existed: true }, error: null }
    }
  }

  const permission = canConvertQuote(quote)
  if (!permission.ok) {
    return { data: null, error: { message: permission.reason ?? 'Conversão bloqueada.', status: 409 } }
  }

  const { data: version, error: versionError } = await ensureAcceptedQuoteVersion(
    companyId,
    quoteId,
    { actorUserId },
  )

  if (versionError || !version) {
    return {
      data: null,
      error: { message: versionError?.message ?? 'Falha ao garantir versão aceita.', status: 500 },
    }
  }

  const { data: existingByVersion, error: existingByVersionError } =
    await findExistingServiceOrder(companyId, version.id)
  if (existingByVersionError) {
    return { data: null, error: { message: existingByVersionError.message, status: 500 } }
  }
  if (existingByVersion) {
    if (!quote.converted_service_order_id) {
      await supabase
        .from('quotes')
        .update({
          converted_service_order_id: existingByVersion.id,
          quote_status: 'converted',
        })
        .eq('id', quoteId)
        .eq('company_id', companyId)
    }
    await attachAgendaToConvertedOrder({
      companyId,
      quoteId,
      serviceOrderId: existingByVersion.id,
      actorUserId,
      order: existingByVersion,
    })
    return { data: { ...existingByVersion, already_existed: true }, error: null }
  }

  const { number: serviceOrderNumber, error: numberError } =
    await getNextServiceOrderNumber(companyId)
  if (numberError || !serviceOrderNumber) {
    return {
      data: null,
      error: {
        message: numberError?.message ?? 'Falha ao gerar número da Ordem de Serviço.',
        status: 500,
      },
    }
  }

  const snapshot = version.commercial_snapshot as SnapshotShape
  const eventSnapshot = snapshot.event ?? null

  const insertPayload = {
    company_id: companyId,
    service_order_number: serviceOrderNumber,
    quote_id: quoteId,
    quote_version_id: version.id,
    event_id: quote.event_id ?? null,
    customer_id: quote.customer_id ?? null,
    status: 'planned',
    event_date: eventSnapshot?.event_date ?? null,
    start_time: eventSnapshot?.start_time ?? null,
    end_time: eventSnapshot?.end_time ?? null,
    venue_name: eventSnapshot?.venue_name ?? null,
    address_line: eventSnapshot?.address_line ?? null,
    city: eventSnapshot?.city ?? null,
    state: eventSnapshot?.state ?? null,
    postal_code: eventSnapshot?.postal_code ?? null,
    physical_guest_count: snapshot.guest_counts?.physical_guest_count ?? null,
    billable_guest_count: snapshot.guest_counts?.billable_guest_count ?? null,
    currency_code: snapshot.currency_code ?? version.currency_code ?? 'USD',
    package_total: version.package_total ?? 0,
    additional_total: version.additional_total ?? 0,
    mileage_fee: version.mileage_fee ?? 0,
    discount_amount: version.discount_amount ?? 0,
    reservation_amount: version.reservation_amount ?? 0,
    balance_due: version.balance_due ?? 0,
    service_order_total: version.quote_total ?? 0,
    commercial_snapshot: snapshot,
    created_by: actorUserId,
  }

  const { data: created, error: insertError } = await supabase
    .from('service_orders')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError) {
    // Corrida: outra requisição converteu a mesma versão simultaneamente.
    if (/duplicate key|unique constraint/i.test(insertError.message)) {
      const { data: raceExisting } = await findExistingServiceOrder(companyId, version.id)
      if (raceExisting) {
        await supabase
          .from('quotes')
          .update({ converted_service_order_id: raceExisting.id, quote_status: 'converted' })
          .eq('id', quoteId)
          .eq('company_id', companyId)
        return { data: { ...raceExisting, already_existed: true }, error: null }
      }
    }
    return { data: null, error: { message: insertError.message, status: 500 } }
  }

  const serviceOrder = created as ServiceOrderRow

  await Promise.all([
    insertServiceOrderItems(companyId, serviceOrder.id, snapshot),
    writeStatusHistory(companyId, serviceOrder.id, actorUserId),
  ])

  // Materiais operacionais (BOM) — somente na criação; não regenera OS existente.
  let packageLabel =
    snapshot.package?.label_pt ||
    snapshot.package?.label ||
    snapshot.package?.package_name ||
    snapshot.package?.name ||
    null
  if (!packageLabel && snapshot.package?.id) {
    const { data: pkg } = await supabase
      .from('packages')
      .select('package_name, label_pt')
      .eq('id', snapshot.package.id)
      .eq('company_id', companyId)
      .maybeSingle()
    packageLabel = pkg?.label_pt || pkg?.package_name || null
  }

  const additionalLabels: Record<string, string> = {}
  const addIds = (snapshot.additional_items ?? [])
    .map((a) => a.additional_item_id)
    .filter((id): id is string => Boolean(id))
  if (addIds.length > 0) {
    const { data: cats } = await supabase
      .from('catalog_items')
      .select('id, item_name, label_pt')
      .eq('company_id', companyId)
      .in('id', addIds)
    for (const c of cats ?? []) {
      additionalLabels[c.id] = c.label_pt || c.item_name || 'Adicional'
    }
  }

  await generateOrderMaterialsFromBom({
    companyId,
    serviceOrderId: serviceOrder.id,
    snapshot,
    actorUserId,
    sourceLabels: { packageLabel, additionalLabels },
  })

  await supabase
    .from('quotes')
    .update({ converted_service_order_id: serviceOrder.id, quote_status: 'converted' })
    .eq('id', quoteId)
    .eq('company_id', companyId)

  await attachAgendaToConvertedOrder({
    companyId,
    quoteId,
    serviceOrderId: serviceOrder.id,
    actorUserId,
    order: serviceOrder,
  })

  await writeAuditLog({
    companyId,
    actorUserId,
    serviceOrderId: serviceOrder.id,
    quoteId,
  })

  return { data: { ...serviceOrder, already_existed: false }, error: null }
}
