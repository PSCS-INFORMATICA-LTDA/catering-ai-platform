import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { fetchInvoiceBackofficeDetail } from './fetchInvoiceBackoffice'
import {
  computeEventFinalTotal,
  computeFinancialCheck,
  paymentLinkObservabilityState,
  toOutboxObservabilityRow,
} from './financeObservability'
import type { InvoiceObservabilityPayload } from './financeObservabilityTypes'
import {
  sanitizeJsonForObservability,
  sanitizeOutboxPayload,
  sanitizePaymentMetadataForBackoffice,
  summarizeIdempotencyKey,
} from './sanitizeFinanceObservability'
import type { InvoiceKind, InvoiceStatus } from './types'

const FINANCE_AUDIT_TYPES = [
  'invoice',
  'invoice_payment',
  'invoice_refund',
  'invoice_cancellation',
  'event_financial_closeout',
  'company_payment_provider',
]

export async function fetchInvoiceObservability(input: {
  companyId: string
  invoiceId: string
}): Promise<{
  data: InvoiceObservabilityPayload | null
  error: { message: string; status?: number } | null
}> {
  const detail = await fetchInvoiceBackofficeDetail(input.companyId, input.invoiceId)
  if (detail.error) return { data: null, error: detail.error }
  if (!detail.data) return { data: null, error: { message: 'invoice_not_found', status: 404 } }

  const invoice = detail.data
  const supabase = getSupabaseServerClient()
  const paymentIds = invoice.payments.map((payment) => payment.id)
  const refundIds = invoice.refunds.map((refund) => refund.id)
  const cancellationIds = invoice.cancellations.map((item) => item.id)
  const relatedIds = [
    invoice.id,
    invoice.closeout_id,
    invoice.service_order_id,
    invoice.parent_invoice_id,
    ...paymentIds,
    ...refundIds,
    ...cancellationIds,
  ].filter((value): value is string => Boolean(value))

  const [paymentsMeta, outboxResult, auditResult, closeoutResult, parentDetail, orderResult] =
    await Promise.all([
      supabase
        .from('invoice_payments')
        .select('id, idempotency_key, metadata')
        .eq('company_id', input.companyId)
        .eq('invoice_id', input.invoiceId),
      supabase
        .from('finance_integration_outbox')
        .select(
          'id, event_type, aggregate_type, aggregate_id, dedup_key, destination, status, attempts, available_at, published_at, last_error, created_at, payload',
        )
        .eq('company_id', input.companyId)
        .or(
          [
            `aggregate_id.eq.${input.invoiceId}`,
            paymentIds.length ? `aggregate_id.in.(${paymentIds.join(',')})` : null,
          ]
            .filter(Boolean)
            .join(','),
        )
        .order('created_at', { ascending: false })
        .limit(50),
      relatedIds.length
        ? supabase
            .from('audit_logs')
            .select('id, action, entity_type, entity_id, created_at, user_id, old_data, new_data')
            .eq('company_id', input.companyId)
            .in('entity_type', FINANCE_AUDIT_TYPES)
            .in('entity_id', relatedIds)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      invoice.closeout_id || invoice.invoice_kind === 'original'
        ? supabase
            .from('event_financial_closeouts')
            .select(
              'id, service_order_id, original_invoice_id, supplemental_invoice_id, original_invoice_total, adjustment_total, status',
            )
            .eq('company_id', input.companyId)
            .or(
              [
                invoice.closeout_id ? `id.eq.${invoice.closeout_id}` : null,
                `original_invoice_id.eq.${invoice.id}`,
                `supplemental_invoice_id.eq.${invoice.id}`,
              ]
                .filter(Boolean)
                .join(','),
            )
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      invoice.parent_invoice_id
        ? supabase
            .from('invoices')
            .select('id, invoice_number, total, paid_total, status')
            .eq('company_id', input.companyId)
            .eq('id', invoice.parent_invoice_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      invoice.service_order_id
        ? supabase
            .from('service_orders')
            .select('id, service_order_number')
            .eq('company_id', input.companyId)
            .eq('id', invoice.service_order_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

  for (const result of [paymentsMeta, outboxResult, auditResult, closeoutResult, parentDetail, orderResult]) {
    if (result.error) {
      return { data: null, error: { message: result.error.message } }
    }
  }

  const metaById = new Map(
    (paymentsMeta.data ?? []).map((row) => [
      String(row.id),
      {
        idempotency_key: row.idempotency_key ? String(row.idempotency_key) : null,
        metadata: row.metadata,
      },
    ]),
  )

  const completedPaymentsTotal = invoice.payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const refundedTotal = invoice.refunds
    .filter((refund) => refund.status === 'completed')
    .reduce((sum, refund) => sum + refund.amount, 0)

  const closeout = closeoutResult.data
  const adjustment = invoice.snapshot?.adjustment
  const originalTotal =
    adjustment?.originalInvoiceTotal ??
    (closeout ? Number(closeout.original_invoice_total) : invoice.invoice_kind === 'original' ? invoice.total : null)
  const adjustmentTotal =
    invoice.invoice_kind === 'post_event_adjustment'
      ? invoice.total
      : invoice.supplemental_invoices.reduce((sum, child) => sum + child.total, 0)
  const totals =
    originalTotal != null
      ? computeEventFinalTotal(originalTotal, adjustmentTotal)
      : { original_total: null, adjustment_total: null, final_event_total: null }

  const serviceOrderNumber =
    orderResult.data?.service_order_number ||
    adjustment?.serviceOrderNumber ||
    null

  return {
    data: {
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_kind: invoice.invoice_kind,
        status: invoice.status,
        currency_code: invoice.currency_code,
        subtotal: invoice.subtotal,
        total: invoice.total,
        paid_total: invoice.paid_total,
        outstanding_amount: invoice.outstanding_amount,
        deposit_amount: invoice.deposit_amount,
        balance_amount: invoice.balance_amount,
        quote_id: invoice.quote_id,
        quote_number: invoice.quote_number,
        service_order_id: invoice.service_order_id,
        service_order_number: serviceOrderNumber,
        closeout_id: invoice.closeout_id,
        customer_name: invoice.customer_name,
        customer_email: invoice.snapshot?.customer.email ?? null,
        customer_phone: invoice.snapshot?.customer.phone ?? null,
        event_name: invoice.event_name,
        event_date: invoice.event_date,
        locale: invoice.locale,
      },
      lineage: {
        kind: invoice.invoice_kind,
        parent: parentDetail.data
          ? {
              id: String(parentDetail.data.id),
              invoice_number: String(parentDetail.data.invoice_number),
              total: Number(parentDetail.data.total || 0),
              paid_total: Number(parentDetail.data.paid_total || 0),
              status: parentDetail.data.status as InvoiceStatus,
            }
          : invoice.parent_invoice_id
            ? {
                id: invoice.parent_invoice_id,
                invoice_number: invoice.parent_invoice_number || invoice.parent_invoice_id,
                total: originalTotal ?? 0,
                paid_total: 0,
                status: 'paid',
              }
            : null,
        supplements: invoice.supplemental_invoices,
        service_order_id: invoice.service_order_id,
        service_order_number: serviceOrderNumber,
        closeout_id: invoice.closeout_id || (closeout ? String(closeout.id) : null),
        original_total: totals.original_total,
        adjustment_total: totals.adjustment_total,
        final_event_total: totals.final_event_total,
      },
      payments: invoice.payments.map((payment) => {
        const meta = metaById.get(payment.id)
        return {
          id: payment.id,
          provider: payment.provider,
          purpose: payment.purpose,
          status: payment.status,
          amount: payment.amount,
          currency_code: payment.currency_code,
          created_at: payment.created_at,
          captured_at: payment.captured_at,
          provider_order_id: payment.provider_order_id,
          provider_capture_id: payment.provider_capture_id,
          idempotency_summary: summarizeIdempotencyKey(meta?.idempotency_key),
          metadata: sanitizePaymentMetadataForBackoffice(meta?.metadata),
        }
      }),
      payment_links: invoice.payment_links.map((link) => ({
        id: link.id,
        purpose: link.purpose,
        created_at: link.created_at,
        expires_at: link.expires_at,
        revoked_at: link.revoked_at,
        state: paymentLinkObservabilityState(link),
      })),
      refunds: invoice.refunds.map((refund) => ({
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        reason: refund.reason,
        provider_refund_id: refund.provider_refund_id,
        requested_at: refund.requested_at,
        completed_at: refund.completed_at,
      })),
      cancellations: invoice.cancellations.map((cancellation) => ({
        id: cancellation.id,
        status: cancellation.status,
        reason: cancellation.reason,
        requested_at: cancellation.requested_at,
        agenda_released_at: cancellation.agenda_released_at,
        completed_at: cancellation.completed_at,
      })),
      outbox: (outboxResult.data ?? []).map((row) => {
        const payload = sanitizeOutboxPayload(row.payload)
        return toOutboxObservabilityRow({
          id: String(row.id),
          event_type: String(row.event_type),
          aggregate_type: String(row.aggregate_type),
          aggregate_id: String(row.aggregate_id),
          dedup_key: String(row.dedup_key),
          destination: String(row.destination),
          status: String(row.status),
          attempts: Number(row.attempts || 0),
          available_at: String(row.available_at),
          published_at: row.published_at ? String(row.published_at) : null,
          last_error: row.last_error ? String(row.last_error) : null,
          created_at: String(row.created_at),
          invoice_id: payload.invoice_id ? String(payload.invoice_id) : invoice.id,
          invoice_number: payload.invoice_number ? String(payload.invoice_number) : invoice.invoice_number,
          invoice_kind: (payload.invoice_kind as InvoiceKind) || invoice.invoice_kind,
          parent_invoice_id: payload.parent_invoice_id
            ? String(payload.parent_invoice_id)
            : invoice.parent_invoice_id,
          payment_id: payload.payment_id ? String(payload.payment_id) : null,
        })
      }),
      audit: (auditResult.data ?? []).map((row) => ({
        id: String(row.id),
        action: String(row.action),
        entity_type: String(row.entity_type),
        entity_id: String(row.entity_id),
        created_at: String(row.created_at),
        user_id: row.user_id ? String(row.user_id) : null,
        data: sanitizeJsonForObservability({
          old_data: row.old_data,
          new_data: row.new_data,
        }),
      })),
      financial_check: computeFinancialCheck({
        invoiceTotal: invoice.total,
        invoicePaidTotal: invoice.paid_total,
        invoiceStatus: invoice.status,
        depositAmount: invoice.deposit_amount,
        canceled: invoice.status === 'canceled',
        completedPaymentsTotal,
        refundedTotal,
      }),
    },
    error: null,
  }
}
