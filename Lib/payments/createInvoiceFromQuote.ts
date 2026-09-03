import 'server-only'

import { fetchQuoteDetail } from '@/Lib/fetchQuoteDetail'
import { getNextInvoiceNumber } from '@/Lib/getNextDocumentNumber'
import { isQuoteAccepted, isQuoteConverted } from '@/Lib/quotes/statusMachine'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { buildInvoiceSnapshot } from './invoiceSnapshot'
import type { InvoiceRecord, InvoiceSnapshot } from './types'

export type CreateInvoiceResult =
  | { ok: true; invoice: InvoiceRecord; alreadyExisted: boolean }
  | { ok: false; status: number; error: string }

function toInvoice(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    quote_id: String(row.quote_id),
    invoice_number: String(row.invoice_number),
    status: row.status as InvoiceRecord['status'],
    locale: row.locale as InvoiceRecord['locale'],
    currency_code: String(row.currency_code || 'USD'),
    snapshot: row.snapshot as InvoiceSnapshot,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    deposit_amount: Number(row.deposit_amount),
    balance_amount: Number(row.balance_amount),
    paid_total: Number(row.paid_total),
    online_payment_fee: 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function createInvoiceFromQuote(input: {
  companyId: string
  quoteId: string
  actorUserId?: string | null
}): Promise<CreateInvoiceResult> {
  const supabase = getSupabaseServerClient()
  const existing = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('quote_id', input.quoteId)
    .neq('status', 'canceled')
    .maybeSingle()

  if (existing.data) {
    return { ok: true, invoice: toInvoice(existing.data), alreadyExisted: true }
  }

  const { data: quote, error: quoteError } = await fetchQuoteDetail(input.quoteId)
  if (quoteError || !quote) {
    return { ok: false, status: 404, error: 'quote_not_found' }
  }

  const quoteCompany = await supabase
    .from('quotes')
    .select('id, company_id, quote_status, proposal_response, quote_total, reservation_amount, pricing_breakdown')
    .eq('id', input.quoteId)
    .eq('company_id', input.companyId)
    .maybeSingle()

  if (!quoteCompany.data) {
    return { ok: false, status: 404, error: 'quote_not_found' }
  }

  if (
    !isQuoteAccepted({
      quote_status: quoteCompany.data.quote_status,
      proposal_response: quoteCompany.data.proposal_response,
    }) &&
    !isQuoteConverted({
      quote_status: quoteCompany.data.quote_status,
    })
  ) {
    return { ok: false, status: 409, error: 'quote_not_accepted' }
  }

  const snapshot = buildInvoiceSnapshot(quote)
  if (snapshot.totals.total <= 0) {
    return { ok: false, status: 409, error: 'invoice_total_invalid' }
  }

  const numbered = await getNextInvoiceNumber(input.companyId)
  if (!numbered.number) {
    return { ok: false, status: 500, error: 'invoice_number_failed' }
  }

  const inserted = await supabase
    .from('invoices')
    .insert({
      company_id: input.companyId,
      quote_id: input.quoteId,
      invoice_number: numbered.number,
      status: 'awaiting_deposit',
      locale: snapshot.locale,
      currency_code: snapshot.totals.currency,
      snapshot,
      subtotal: snapshot.totals.subtotal,
      total: snapshot.totals.total,
      deposit_amount: snapshot.reservation.depositAmount,
      balance_amount: snapshot.reservation.balanceAmount,
      paid_total: 0,
      online_payment_fee: 0,
      created_by: input.actorUserId ?? null,
    })
    .select('*')
    .single()

  if (inserted.error || !inserted.data) {
    const race = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', input.companyId)
      .eq('quote_id', input.quoteId)
      .neq('status', 'canceled')
      .maybeSingle()
    if (race.data) {
      return { ok: true, invoice: toInvoice(race.data), alreadyExisted: true }
    }
    return { ok: false, status: 500, error: inserted.error?.message || 'invoice_insert_failed' }
  }

  return { ok: true, invoice: toInvoice(inserted.data), alreadyExisted: false }
}

export async function loadCompanyInvoice(
  companyId: string,
  invoiceId: string,
): Promise<InvoiceRecord | null> {
  const { data } = await getSupabaseServerClient()
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', invoiceId)
    .maybeSingle()
  return data ? toInvoice(data) : null
}

export { toInvoice }
