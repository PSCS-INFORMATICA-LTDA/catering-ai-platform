import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const QUOTE_VERSION_SNAPSHOT_SCHEMA_VERSION = 1

export type QuoteVersionRow = {
  id: string
  company_id: string
  quote_id: string
  version_number: number
  language: string
  currency_code: string
  package_total: number
  additional_total: number
  mileage_fee: number
  discount_amount: number
  reservation_amount: number
  balance_due: number
  quote_total: number
  commercial_snapshot: Record<string, unknown>
  schema_version: number
  is_current: boolean
  accepted_at: string | null
  created_by: string | null
  created_at: string
}

type QuoteRowForSnapshot = {
  id: string
  company_id: string
  quote_number: string | null
  quote_status: string | null
  language: string | null
  currency_code: string | null
  customer_id: string | null
  event_id: string | null
  package_id: string | null
  package_price_per_person: number | null
  adult_count: number | null
  children_under_3_count: number | null
  children_4_to_12_count: number | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  package_total: number | null
  additional_total: number | null
  mileage_base_location: string | null
  mileage_distance: number | null
  mileage_free_limit: number | null
  mileage_rate: number | null
  mileage_fee: number | null
  discount: number | null
  discount_amount: number | null
  reservation_percentage: number | null
  reservation_amount: number | null
  balance_due: number | null
  quote_total: number | null
  proposal_response: string | null
  proposal_accepted_at: string | null
  active: boolean | null
}

const QUOTE_SNAPSHOT_SELECT = `
  id, company_id, quote_number, quote_status, language, currency_code,
  customer_id, event_id, package_id, package_price_per_person,
  adult_count, children_under_3_count, children_4_to_12_count, physical_guest_count, billable_guest_count,
  package_total, additional_total,
  mileage_base_location, mileage_distance, mileage_free_limit, mileage_rate, mileage_fee,
  discount, discount_amount, reservation_percentage, reservation_amount, balance_due, quote_total,
  proposal_response, proposal_accepted_at, active
`.trim()

async function fetchQuoteRowForSnapshot(
  companyId: string,
  quoteId: string,
): Promise<{ data: QuoteRowForSnapshot | null; error: { message: string } | null }> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SNAPSHOT_SELECT)
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return { data: null, error: { message: error.message } }
  if (!data) return { data: null, error: { message: 'Cotação não encontrada.' } }
  return { data: data as unknown as QuoteRowForSnapshot, error: null }
}

async function fetchEventForSnapshot(eventId: string | null) {
  if (!eventId) return null
  const supabase = getSupabaseServerClient()
  const { data } = await supabase
    .from('events')
    .select(
      'event_date, start_time, end_time, venue_name, address_line, city, state, postal_code',
    )
    .eq('id', eventId)
    .maybeSingle()
  return data ?? null
}

async function fetchAdditionalItemsForSnapshot(quoteId: string) {
  const supabase = getSupabaseServerClient()
  const { data } = await supabase
    .from('quote_additional_items')
    .select('additional_item_id, quantity, unit_price, total_price, selected')
    .eq('quote_id', quoteId)
  return data ?? []
}

/**
 * Monta o `commercial_snapshot` JSONB imutável a partir do estado atual da
 * cotação. Não recalcula com o catálogo/pacote atual (ADR §3).
 */
export async function buildCommercialSnapshotFromQuote(
  companyId: string,
  quoteId: string,
): Promise<{ snapshot: Record<string, unknown> | null; quote: QuoteRowForSnapshot | null; error: { message: string } | null }> {
  const { data: quote, error } = await fetchQuoteRowForSnapshot(companyId, quoteId)
  if (error || !quote) return { snapshot: null, quote: null, error }

  const [event, additionalItems] = await Promise.all([
    fetchEventForSnapshot(quote.event_id),
    fetchAdditionalItemsForSnapshot(quoteId),
  ])

  const snapshot: Record<string, unknown> = {
    schema_version: QUOTE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    quote_number: quote.quote_number,
    language: quote.language ?? 'pt',
    currency_code: quote.currency_code ?? 'USD',
    package: {
      id: quote.package_id,
      price_per_person: quote.package_price_per_person ?? 0,
      total: quote.package_total ?? 0,
    },
    guest_counts: {
      adult_count: quote.adult_count ?? 0,
      children_under_3_count: quote.children_under_3_count ?? 0,
      children_4_to_12_count: quote.children_4_to_12_count ?? 0,
      physical_guest_count: quote.physical_guest_count ?? 0,
      billable_guest_count: quote.billable_guest_count ?? 0,
    },
    additional_items: additionalItems,
    additional_total: quote.additional_total ?? 0,
    mileage: {
      base_location: quote.mileage_base_location,
      distance: quote.mileage_distance,
      free_limit: quote.mileage_free_limit,
      rate: quote.mileage_rate,
      fee: quote.mileage_fee ?? 0,
    },
    discount_amount: quote.discount_amount ?? quote.discount ?? 0,
    reservation: {
      percentage: quote.reservation_percentage,
      amount: quote.reservation_amount ?? 0,
    },
    balance_due: quote.balance_due ?? 0,
    quote_total: quote.quote_total ?? 0,
    event: event
      ? {
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          venue_name: event.venue_name,
          address_line: event.address_line,
          city: event.city,
          state: event.state,
          postal_code: event.postal_code,
        }
      : null,
  }

  return { snapshot, quote, error: null }
}

export async function getCurrentQuoteVersionNumber(quoteId: string): Promise<number> {
  const supabase = getSupabaseServerClient()
  const { data } = await supabase
    .from('quote_versions')
    .select('version_number')
    .eq('quote_id', quoteId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.version_number as number | undefined) ?? 0
}

export type CreateQuoteVersionOptions = {
  createdBy?: string | null
  markAccepted?: boolean
  acceptedAt?: string | null
}

/**
 * Cria uma nova versão comercial da cotação a partir do estado atual.
 * Marca a versão anterior como não-corrente (no máximo uma `is_current`).
 */
export async function createQuoteVersion(
  companyId: string,
  quoteId: string,
  options: CreateQuoteVersionOptions = {},
): Promise<{ data: QuoteVersionRow | null; error: { message: string } | null }> {
  const supabase = getSupabaseServerClient()
  const { snapshot, quote, error: snapshotError } =
    await buildCommercialSnapshotFromQuote(companyId, quoteId)

  if (snapshotError || !snapshot || !quote) {
    return { data: null, error: snapshotError ?? { message: 'Falha ao montar snapshot.' } }
  }

  const nextVersionNumber = (await getCurrentQuoteVersionNumber(quoteId)) + 1

  const { error: clearCurrentError } = await supabase
    .from('quote_versions')
    .update({ is_current: false })
    .eq('quote_id', quoteId)
    .eq('is_current', true)

  if (clearCurrentError) {
    return { data: null, error: { message: clearCurrentError.message } }
  }

  const acceptedAt = options.markAccepted
    ? options.acceptedAt ?? quote.proposal_accepted_at ?? new Date().toISOString()
    : null

  const { data, error } = await supabase
    .from('quote_versions')
    .insert({
      company_id: companyId,
      quote_id: quoteId,
      version_number: nextVersionNumber,
      language: quote.language ?? 'pt',
      currency_code: quote.currency_code ?? 'USD',
      package_total: quote.package_total ?? 0,
      additional_total: quote.additional_total ?? 0,
      mileage_fee: quote.mileage_fee ?? 0,
      discount_amount: quote.discount_amount ?? quote.discount ?? 0,
      reservation_amount: quote.reservation_amount ?? 0,
      balance_due: quote.balance_due ?? 0,
      quote_total: quote.quote_total ?? 0,
      commercial_snapshot: snapshot,
      schema_version: QUOTE_VERSION_SNAPSHOT_SCHEMA_VERSION,
      is_current: true,
      accepted_at: acceptedAt,
      created_by: options.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) return { data: null, error: { message: error.message } }

  if (options.markAccepted) {
    await supabase
      .from('quotes')
      .update({ accepted_version_id: data.id })
      .eq('id', quoteId)
      .eq('company_id', companyId)
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: options.createdBy ?? null,
    entityType: 'quote_version',
    entityId: data.id,
    action: options.markAccepted ? 'quote_version_accepted' : 'quote_version_created',
    newData: {
      quote_id: quoteId,
      version_number: nextVersionNumber,
      quote_total: data.quote_total,
    },
  })

  return { data: data as QuoteVersionRow, error: null }
}

/**
 * Garante que existe uma versão aceita para a cotação (idempotente).
 * Cotações criadas antes desta fundação não têm `quote_versions` — a versão
 * é criada de forma preguiçosa (lazy) a partir do estado aceito atual.
 */
export async function ensureAcceptedQuoteVersion(
  companyId: string,
  quoteId: string,
  options: { actorUserId?: string | null } = {},
): Promise<{ data: QuoteVersionRow | null; error: { message: string } | null }> {
  const supabase = getSupabaseServerClient()

  const { data: quoteRow, error: quoteError } = await supabase
    .from('quotes')
    .select('accepted_version_id, proposal_accepted_at')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (quoteError) return { data: null, error: { message: quoteError.message } }

  if (quoteRow?.accepted_version_id) {
    const { data: existing, error: existingError } = await supabase
      .from('quote_versions')
      .select('*')
      .eq('id', quoteRow.accepted_version_id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (existingError) return { data: null, error: { message: existingError.message } }
    if (existing) return { data: existing as QuoteVersionRow, error: null }
  }

  // Sem versão aceita registrada — verifica se já existe alguma versão
  // marcada accepted_at (ex.: criada em execução anterior) antes de criar nova.
  const { data: anyAccepted } = await supabase
    .from('quote_versions')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('company_id', companyId)
    .not('accepted_at', 'is', null)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (anyAccepted) {
    await supabase
      .from('quotes')
      .update({ accepted_version_id: anyAccepted.id })
      .eq('id', quoteId)
      .eq('company_id', companyId)
    return { data: anyAccepted as QuoteVersionRow, error: null }
  }

  return createQuoteVersion(companyId, quoteId, {
    createdBy: options.actorUserId ?? null,
    markAccepted: true,
    acceptedAt: quoteRow?.proposal_accepted_at ?? null,
  })
}
