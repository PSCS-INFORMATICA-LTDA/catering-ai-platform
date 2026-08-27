import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { toInvoice } from './createInvoiceFromQuote'
import {
  hashPaymentLinkToken,
  isPaymentLinkUsable,
} from './paymentLinks'
import type {
  InvoicePaymentLinkRecord,
  InvoiceRecord,
  PaymentPurpose,
} from './types'

export async function resolvePaymentLink(token: string): Promise<
  | { ok: true; invoice: InvoiceRecord; link: InvoicePaymentLinkRecord }
  | { ok: false; status: number; error: string }
> {
  const tokenHash = hashPaymentLinkToken(token)
  const supabase = getSupabaseServerClient()
  const { data: link } = await supabase
    .from('invoice_payment_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!link) return { ok: false, status: 404, error: 'not_found' }

  const usable = isPaymentLinkUsable({
    revokedAt: link.revoked_at,
    expiresAt: link.expires_at,
  })
  if (!usable.ok) {
    return { ok: false, status: 410, error: usable.reason }
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', link.invoice_id)
    .eq('company_id', link.company_id)
    .maybeSingle()
  if (!invoice) return { ok: false, status: 404, error: 'not_found' }
  if (invoice.status === 'canceled') {
    return { ok: false, status: 410, error: 'canceled' }
  }

  return {
    ok: true,
    invoice: toInvoice(invoice),
    link: {
      id: String(link.id),
      company_id: String(link.company_id),
      invoice_id: String(link.invoice_id),
      token_hash: String(link.token_hash),
      purpose: link.purpose as PaymentPurpose,
      expires_at: link.expires_at,
      revoked_at: link.revoked_at,
      created_at: String(link.created_at),
    },
  }
}

export async function createInvoicePaymentLink(input: {
  companyId: string
  invoiceId: string
  purpose: PaymentPurpose
  rawToken: string
  tokenHash: string
  expiresAt: string | null
  actorUserId?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await getSupabaseServerClient()
    .from('invoice_payment_links')
    .insert({
      company_id: input.companyId,
      invoice_id: input.invoiceId,
      token_hash: input.tokenHash,
      purpose: input.purpose,
      expires_at: input.expiresAt,
      created_by: input.actorUserId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message || 'link_insert_failed' }
  return { ok: true, id: String(data.id) }
}
