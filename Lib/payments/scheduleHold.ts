import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type PaymentScheduleHoldResult = {
  ok: boolean
  status: 'held' | 'already_reserved' | 'unavailable' | 'error'
  holdId?: string | null
  expiresAt?: string | null
  minGapMinutes?: number | null
  error?: string
}

function mapRpcError(message?: string | null): PaymentScheduleHoldResult {
  const code = String(message || '')
  if (
    code.includes('schedule_unavailable') ||
    code.includes('schedule_temporarily_held') ||
    code.includes('schedule_snapshot_mismatch') ||
    code.includes('schedule_snapshot_missing') ||
    code.includes('schedule_details_invalid') ||
    code.includes('quote_not_accepted') ||
    code.includes('invoice_not_payable')
  ) {
    return { ok: false, status: 'unavailable', error: code }
  }
  return { ok: false, status: 'error', error: code || 'schedule_hold_failed' }
}

export async function acquirePaymentScheduleHold(input: {
  companyId: string
  invoiceId: string
  paymentLinkId?: string | null
  holdSeconds?: number
}): Promise<PaymentScheduleHoldResult> {
  const { data, error } = await getSupabaseServerClient().rpc('acquire_payment_schedule_hold', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
    p_payment_link_id: input.paymentLinkId ?? null,
    p_hold_seconds: input.holdSeconds ?? 900,
  })
  if (error) return mapRpcError(error.message)
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return { ok: false, status: 'error', error: 'schedule_hold_empty' }
  const status = String(row.hold_status || '')
  if (status === 'already_reserved') {
    return { ok: true, status: 'already_reserved' }
  }
  return {
    ok: true,
    status: 'held',
    holdId: row.hold_id ? String(row.hold_id) : null,
    expiresAt: row.hold_expires_at ? String(row.hold_expires_at) : null,
    minGapMinutes: row.min_gap_minutes == null ? null : Number(row.min_gap_minutes),
  }
}

export async function releasePaymentScheduleHold(input: {
  companyId: string
  invoiceId: string
  reason: string
}) {
  const { error } = await getSupabaseServerClient().rpc('release_payment_schedule_hold', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
    p_reason: input.reason,
  })
  return { ok: !error, error: error?.message ?? null }
}

export async function consumePaymentScheduleHold(input: {
  companyId: string
  invoiceId: string
}) {
  const { error } = await getSupabaseServerClient().rpc('consume_payment_schedule_hold', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
  })
  return { ok: !error, error: error?.message ?? null }
}
