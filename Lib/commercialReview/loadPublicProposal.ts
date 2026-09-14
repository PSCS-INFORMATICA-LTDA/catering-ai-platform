import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import { fetchQuoteDetail } from '@/Lib/fetchQuoteDetail'
import {
  applySharedVersionToQuoteDetail,
  publicProposalQuoteFromFacts,
  readFrozenCommercialFacts,
  SHARED_VERSION_MISSING,
  stripInternalNotesFromPublicPayload,
  type FrozenCommercialFacts,
  type ProposalSource,
  type SharedVersionRow,
} from './sharedProposal.ts'

export type PublicProposalResult =
  | {
      ok: true
      status: 200
      source: ProposalSource
      payload: Record<string, unknown>
      quoteId: string
      companyId: string
      sharedVersionId: string | null
      facts: FrozenCommercialFacts | null
    }
  | {
      ok: false
      status: number
      payload: Record<string, unknown>
    }

type QuoteTokenRow = {
  id: string
  company_id: string
  quote_number: string | null
  quote_status: string | null
  quote_total: number | null
  reservation_amount: number | null
  balance_due: number | null
  discount_amount: number | null
  currency_code: string | null
  language: string | null
  adult_count: number | null
  children_under_3_count: number | null
  children_4_to_12_count: number | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  proposal_response: string | null
  proposal_sent_at: string | null
  proposal_shared_version_id: string | null
  customer_id: string | null
  package_id: string | null
  event_id: string | null
  active: boolean | null
  pricing_breakdown: Record<string, unknown> | null
}

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

async function loadSharedVersion(
  companyId: string,
  quoteId: string,
  versionId: string,
): Promise<SharedVersionRow | null> {
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('quote_versions')
    .select(
      'id, quote_id, company_id, version_number, quote_total, reservation_amount, balance_due, discount_amount, package_total, additional_total, mileage_fee, commercial_snapshot',
    )
    .eq('id', versionId)
    .eq('quote_id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error || !data) return null
  return data as SharedVersionRow
}

async function loadPackageLabel(packageId: string | null) {
  if (!packageId) return { label: null, names: {} }
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('packages')
    .select('label_pt, label_en, label_es, package_key')
    .eq('id', packageId)
    .maybeSingle()
  return {
    label: data?.label_pt || data?.package_key || null,
    names: {
      package_name_pt: data?.label_pt ?? null,
      package_name_en: data?.label_en ?? data?.label_pt ?? null,
      package_name_es: data?.label_es ?? data?.label_pt ?? null,
      package_key: data?.package_key ?? null,
    },
  }
}

function legacyFacts(quote: QuoteTokenRow): FrozenCommercialFacts {
  const breakdown =
    quote.pricing_breakdown && typeof quote.pricing_breakdown === 'object'
      ? quote.pricing_breakdown
      : null
  return {
    source: 'legacy_live_quote',
    versionId: null,
    quote_total: quote.quote_total,
    reservation_amount: quote.reservation_amount,
    balance_due: quote.balance_due,
    discount_amount: quote.discount_amount,
    package_total: null,
    additional_total: null,
    mileage_fee: null,
    mileage_distance: null,
    mileage_free_limit: null,
    mileage_rate: null,
    mileage_base_location: null,
    reservation_percentage: null,
    package_id: quote.package_id,
    package_price_per_person: null,
    adult_count: quote.adult_count,
    children_under_3_count: quote.children_under_3_count,
    children_4_to_12_count: quote.children_4_to_12_count,
    physical_guest_count: quote.physical_guest_count,
    billable_guest_count: quote.billable_guest_count,
    language: quote.language,
    currency_code: quote.currency_code ?? 'USD',
    event_date: null,
    event_name: null,
    start_time: null,
    end_time: null,
    venue_name: null,
    address_line: null,
    city: null,
    state: null,
    postal_code: null,
    pricing_breakdown: breakdown,
    additional_items: null,
    coupon:
      breakdown && typeof breakdown.coupon === 'object'
        ? {
            code:
              typeof (breakdown.coupon as { code?: string }).code === 'string'
                ? (breakdown.coupon as { code?: string }).code ?? null
                : null,
            approval_status:
              typeof (breakdown.coupon as { approval_status?: string })
                .approval_status === 'string'
                ? (breakdown.coupon as { approval_status?: string })
                    .approval_status ?? null
                : null,
            applied_discount_amount: Number(
              (breakdown.coupon as { applied_discount_amount?: number })
                .applied_discount_amount ?? 0,
            ),
          }
        : null,
  }
}

export async function loadPublicProposalByToken(
  token: string,
): Promise<PublicProposalResult> {
  if (invalidToken(token)) {
    return { ok: false, status: 200, payload: { found: false } }
  }

  const db = getSupabaseServerClient()
  const trimmed = token.trim()
  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, quote_total, reservation_amount, balance_due, discount_amount, currency_code, language, adult_count, children_under_3_count, children_4_to_12_count, physical_guest_count, billable_guest_count, proposal_response, proposal_sent_at, proposal_shared_version_id, customer_id, package_id, event_id, active, pricing_breakdown',
    )
    .eq('proposal_token', trimmed)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    if (/proposal_token|column/i.test(error.message)) {
      return {
        ok: false,
        status: 200,
        payload: { found: false, error: 'migration_required' },
      }
    }
    return {
      ok: false,
      status: 500,
      payload: { found: false, error: error.message },
    }
  }
  if (!quote) {
    return { ok: false, status: 200, payload: { found: false } }
  }

  const row = quote as QuoteTokenRow
  const pin = row.proposal_shared_version_id
  let source: ProposalSource = 'legacy_live_quote'
  let facts = legacyFacts(row)
  let sharedVersionId: string | null = null

  if (pin) {
    const version = await loadSharedVersion(row.company_id, row.id, pin)
    if (!version) {
      return {
        ok: false,
        status: 409,
        payload: {
          found: false,
          error: 'A versão compartilhada da proposta não está disponível.',
          code: SHARED_VERSION_MISSING,
        },
      }
    }
    facts = readFrozenCommercialFacts(version)
    source = 'shared_version'
    sharedVersionId = version.id
  }

  const [companyRes, customerRes, eventRes, packageInfo] = await Promise.all([
    db
      .from('companies')
      .select('name, trade_name')
      .eq('id', row.company_id)
      .maybeSingle(),
    row.customer_id
      ? db
          .from('customers')
          .select('full_name, ab_name, contact_name, company_name, phone, email')
          .eq('id', row.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.event_id
      ? db
          .from('events')
          .select('event_date, event_name')
          .eq('id', row.event_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadPackageLabel(facts.package_id || row.package_id),
  ])

  const customer = customerRes.data
  const customerName =
    customer?.full_name ||
    customer?.ab_name ||
    customer?.contact_name ||
    customer?.company_name ||
    null

  const payload = stripInternalNotesFromPublicPayload({
    found: true,
    source,
    proposal_shared_version_id: sharedVersionId,
    company_name:
      companyRes.data?.trade_name || companyRes.data?.name || 'BBQ At Home',
    proposal_response: row.proposal_response ?? 'pending',
    proposal_sent_at: row.proposal_sent_at,
    can_respond:
      (row.proposal_response ?? 'pending') === 'pending' &&
      Boolean(row.proposal_sent_at),
    quote: publicProposalQuoteFromFacts({
      quoteId: row.id,
      quoteNumber: row.quote_number,
      quoteStatus: row.quote_status,
      packageLabel: packageInfo.label,
      customerName,
      customerPhone: customer?.phone ?? null,
      customerEmail: customer?.email ?? null,
      eventName: facts.event_name ?? eventRes.data?.event_name ?? null,
      facts: {
        ...facts,
        event_date: facts.event_date ?? eventRes.data?.event_date ?? null,
      },
    }),
  })

  return {
    ok: true,
    status: 200,
    source,
    payload,
    quoteId: row.id,
    companyId: row.company_id,
    sharedVersionId,
    facts,
  }
}

export async function loadFrozenQuoteDetailForProposal(input: {
  quoteId: string
  companyId: string
  sharedVersionId: string
}): Promise<
  | { ok: true; quote: QuoteDetail }
  | { ok: false; code: string; error: string }
> {
  const [detail, version] = await Promise.all([
    fetchQuoteDetail(input.quoteId, null, { companyId: input.companyId }),
    loadSharedVersion(input.companyId, input.quoteId, input.sharedVersionId),
  ])
  if (detail.error || !detail.data) {
    return { ok: false, code: 'quote_not_found', error: 'Cotação não encontrada.' }
  }
  if (!version) {
    return {
      ok: false,
      code: SHARED_VERSION_MISSING,
      error: 'A versão compartilhada da proposta não está disponível.',
    }
  }
  const packageInfo = await loadPackageLabel(
    readFrozenCommercialFacts(version).package_id || detail.data.package_id || null,
  )
  return {
    ok: true,
    quote: applySharedVersionToQuoteDetail(detail.data, version, packageInfo.names),
  }
}
