import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import type { CustomerNameSource } from '@/Lib/getCustomerDisplayName'
import { getActiveCompanyId } from '@/Lib/tenant/resolveTenant'
import { getSupabaseServerClient } from './supabaseServer'

function normalizeQuoteDetailRow(
  raw: Record<string, unknown>,
): QuoteDetail {
  const viewDisplayName = raw.customer_display_name
  const viewCustomerLabel = raw.customer_name
  const displayFromView =
    (typeof viewDisplayName === 'string' ? viewDisplayName : null) ??
    (typeof viewCustomerLabel === 'string' ? viewCustomerLabel : null)
  const customerFields: CustomerNameSource = {
    ab_name:
      (raw.ab_name as string | null | undefined) ?? displayFromView,
    full_name: raw.full_name as string | null | undefined,
    contact_name: raw.contact_name as string | null | undefined,
    company_name: raw.company_name as string | null | undefined,
    email:
      (raw.email as string | null | undefined) ??
      (raw.customer_email as string | null | undefined),
    phone:
      (raw.phone as string | null | undefined) ??
      (raw.customer_phone as string | null | undefined),
  }

  const {
    customer_name: _legacyViewAlias,
    customer_display_name: _viewDisplayAlias,
    ...rest
  } = raw

  return {
    ...rest,
    ...customerFields,
  } as QuoteDetail
}

const OFFICIAL_GUEST_COLUMNS =
  'adult_count, children_under_3_count, children_4_to_12_count, physical_guest_count, billable_guest_count'

const PROPOSAL_COLUMNS =
  'proposal_token, proposal_sent_at, proposal_response, proposal_accepted_at, proposal_rejected_at, proposal_follow_up_count, proposal_last_follow_up_at'

const ORDER_COLUMNS = 'accepted_version_id, converted_service_order_id'

/** Colunas comerciais que a quote_detail_view pode não expor ainda. */
const COMMERCIAL_COLUMNS =
  'holiday_surcharge_amount, minimum_order_amount, minimum_order_applied, reservation_confirmed_at, reservation_confirmed_by, package_total, additional_total, grill_rental_total, grill_rental_required, grill_rental_qty, discount_amount, mileage_base_location, mileage_distance, mileage_free_limit, mileage_rate, mileage_fee, quote_total, reservation_amount, balance_due, reservation_percentage'

const QUOTE_TABLE_COLUMNS = [
  OFFICIAL_GUEST_COLUMNS,
  PROPOSAL_COLUMNS,
  ORDER_COLUMNS,
  COMMERCIAL_COLUMNS,
  'pricing_breakdown',
].join(', ')

async function loadQuoteTableExtras(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  id: string,
  companyId: string,
) {
  const combined = await supabase
    .from('quotes')
    .select(QUOTE_TABLE_COLUMNS)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!combined.error && combined.data) {
    return combined.data as unknown as Record<string, unknown>
  }

  if (combined.error && !/column/i.test(combined.error.message)) {
    console.error(
      `[CDL Quote] Failed to load quote extras for ${id}:`,
      combined.error.message,
    )
  }

  const [guestRes, proposalRes, orderRes, commercialRes, breakdownRes] =
    await Promise.all([
      supabase
        .from('quotes')
        .select(OFFICIAL_GUEST_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select(PROPOSAL_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select(ORDER_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select(COMMERCIAL_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select('pricing_breakdown')
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
    ])

  return {
    ...(guestRes.data ?? {}),
    ...(proposalRes.data && !proposalRes.error ? proposalRes.data : {}),
    ...(orderRes.data && !orderRes.error ? orderRes.data : {}),
    ...(commercialRes.data && !commercialRes.error ? commercialRes.data : {}),
    ...(breakdownRes.data && !breakdownRes.error ? breakdownRes.data : {}),
  } as Record<string, unknown>
}

export async function fetchQuoteDetail(
  id: string,
  displayLanguage?: string | null,
  options?: { companyId?: string },
) {
  const startedAt = Date.now()
  const companyId = options?.companyId?.trim() || getActiveCompanyId()
  const supabase = getSupabaseServerClient()

  const [viewRes, quoteExtras] = await Promise.all([
    supabase
      .from('quote_detail_view')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single(),
    loadQuoteTableExtras(supabase, id, companyId),
  ])

  if (viewRes.error) {
    return { data: null as QuoteDetail | null, error: viewRes.error }
  }

  const quote = normalizeQuoteDetailRow({
    ...(viewRes.data as Record<string, unknown>),
    ...quoteExtras,
  })

  const data: QuoteDetail = { ...quote }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[quote-detail-timing]', {
      quoteId: id,
      ms: Date.now() - startedAt,
      coreRoundTrips: 2,
      waves: 1,
    })
  }

  return { data, error: null }
}
