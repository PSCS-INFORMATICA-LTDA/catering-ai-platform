'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tFinanceControls } from '@/Lib/i18n/financeControls'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { InvoiceBackofficeDetail } from '@/Lib/payments/fetchInvoiceBackoffice'
import type { PaymentPurpose } from '@/Lib/payments/types'

function formatMoney(value: number, currency: string, locale: string | null | undefined) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

function formatDateTime(value: string | null | undefined, locale: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(toBcp47Locale(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function refundStatusLabel(status: string, locale: string | null | undefined) {
  if (status === 'requested') return tFinanceControls(locale, 'refundStatusRequested')
  if (status === 'processing') return tFinanceControls(locale, 'refundStatusProcessing')
  if (status === 'completed') return tFinanceControls(locale, 'refundStatusCompleted')
  if (status === 'failed') return tFinanceControls(locale, 'refundStatusFailed')
  if (status === 'canceled') return tFinanceControls(locale, 'refundStatusCanceled')
  return status
}

function cancellationStatusLabel(status: string, locale: string | null | undefined) {
  if (status === 'pending_refund') return tFinanceControls(locale, 'cancellationPendingRefund')
  if (status === 'completed') return tFinanceControls(locale, 'cancellationCompleted')
  if (status === 'requested') return tFinanceControls(locale, 'cancellationRequestedStatus')
  if (status === 'rejected') return tFinanceControls(locale, 'cancellationRejected')
  return status
}

export default function FinanceControls({
  invoice,
  canReconcile,
  canRefund,
  canCancel,
}: {
  invoice: InvoiceBackofficeDetail
  canReconcile: boolean
  canRefund: boolean
  canCancel: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const defaultPurpose: PaymentPurpose =
    invoice.paid_total + 0.009 >= invoice.deposit_amount ? 'balance' : 'deposit'
  const [provider, setProvider] = useState<'zelle' | 'bank_transfer'>('zelle')
  const [purpose, setPurpose] = useState<PaymentPurpose>(defaultPurpose)
  const [confirmationReference, setConfirmationReference] = useState('')
  const [confirmationNote, setConfirmationNote] = useState('')

  const completedPayments = useMemo(
    () => invoice.payments.filter((payment) => payment.status === 'completed'),
    [invoice.payments],
  )
  const openRefunds = useMemo(
    () => invoice.refunds.filter((refund) => refund.status === 'requested' || refund.status === 'processing'),
    [invoice.refunds],
  )
  const activeCancellation = invoice.cancellations.find(
    (cancellation) => cancellation.status === 'requested' || cancellation.status === 'pending_refund',
  )

  const [refundPaymentId, setRefundPaymentId] = useState(completedPayments[0]?.id || '')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [completeRefundId, setCompleteRefundId] = useState(openRefunds[0]?.id || '')
  const [refundReference, setRefundReference] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
    return payload
  }

  function begin(action: string) {
    setBusy(action)
    setMessage(null)
    setError(null)
  }

  function finish(successMessage: string) {
    setBusy(null)
    setMessage(successMessage)
    router.refresh()
  }

  function fail(err: unknown) {
    setBusy(null)
    const code = err instanceof Error ? err.message : 'unknown_error'
    if (code === 'service_order_cancellation_required') {
      setError(tFinanceControls(locale, 'serviceOrderCancellationRequired'))
    } else {
      setError(`${tFinanceControls(locale, 'actionError')} (${code})`)
    }
  }

  async function reconcileManualPayment(event: React.FormEvent) {
    event.preventDefault()
    begin('manual')
    try {
      await postJson(`/api/invoices/${invoice.id}/manual-payment`, {
        provider,
        purpose,
        confirmationReference,
        confirmationNote,
      })
      setConfirmationReference('')
      setConfirmationNote('')
      finish(tFinanceControls(locale, 'manualSaved'))
    } catch (err) {
      fail(err)
    }
  }

  async function requestRefund(event: React.FormEvent) {
    event.preventDefault()
    begin('refund-request')
    try {
      await postJson(`/api/invoices/${invoice.id}/refunds`, {
        paymentId: refundPaymentId,
        amount: refundAmount.trim() ? Number(refundAmount) : undefined,
        reason: refundReason,
        idempotencyKey: crypto.randomUUID(),
      })
      setRefundAmount('')
      setRefundReason('')
      finish(tFinanceControls(locale, 'refundRequested'))
    } catch (err) {
      fail(err)
    }
  }

  async function completeRefund(event: React.FormEvent) {
    event.preventDefault()
    begin('refund-complete')
    try {
      await postJson(
        `/api/invoices/${invoice.id}/refunds/${completeRefundId}/complete`,
        { providerRefundId: refundReference },
      )
      setRefundReference('')
      finish(tFinanceControls(locale, 'refundCompleted'))
    } catch (err) {
      fail(err)
    }
  }

  async function requestCancellation(event: React.FormEvent) {
    event.preventDefault()
    begin('cancel')
    try {
      await postJson(`/api/invoices/${invoice.id}/cancel`, {
        reason: cancellationReason,
      })
      setCancellationReason('')
      finish(tFinanceControls(locale, 'cancellationRequested'))
    } catch (err) {
      fail(err)
    }
  }

  if (!canReconcile && !canRefund && !canCancel && invoice.refunds.length === 0 && invoice.cancellations.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">
        {tFinanceControls(locale, 'controlsTitle')}
      </h2>

      {message ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-5 xl:grid-cols-3">
        {canReconcile && invoice.status !== 'canceled' && invoice.status !== 'paid' ? (
          <form onSubmit={reconcileManualPayment} className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-black text-neutral-900">
              {tFinanceControls(locale, 'manualPaymentTitle')}
            </h3>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {tFinanceControls(locale, 'manualPaymentCopy')}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-neutral-600">
                {tFinanceControls(locale, 'provider')}
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as 'zelle' | 'bank_transfer')}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="zelle">{tFinanceControls(locale, 'zelle')}</option>
                  <option value="bank_transfer">{tFinanceControls(locale, 'bankTransfer')}</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-neutral-600">
                {tFinanceControls(locale, 'purpose')}
                <select
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value as PaymentPurpose)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="deposit">{tFinanceControls(locale, 'deposit')}</option>
                  <option value="balance">{tFinanceControls(locale, 'balance')}</option>
                  <option value="full">{tFinanceControls(locale, 'full')}</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-neutral-600">
                {tFinanceControls(locale, 'receiptReference')}
                <input
                  value={confirmationReference}
                  onChange={(event) => setConfirmationReference(event.target.value)}
                  required
                  minLength={3}
                  placeholder={tFinanceControls(locale, 'receiptReferenceHint')}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </label>
              <label className="block text-xs font-bold text-neutral-600">
                {tFinanceControls(locale, 'note')}
                <textarea
                  value={confirmationNote}
                  onChange={(event) => setConfirmationNote(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </label>
              <button
                disabled={busy !== null}
                className="w-full rounded-lg bg-[var(--brand-primary-2,#1e3a5f)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {tFinanceControls(locale, 'confirmReceipt')}
              </button>
            </div>
          </form>
        ) : null}

        {canRefund ? (
          <div className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-black text-neutral-900">{tFinanceControls(locale, 'refundsTitle')}</h3>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              {tFinanceControls(locale, 'noAutomaticRefund')}
            </p>
            {completedPayments.length > 0 ? (
              <form onSubmit={requestRefund} className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-neutral-600">
                  {tFinanceControls(locale, 'payment')}
                  <select
                    value={refundPaymentId}
                    onChange={(event) => setRefundPaymentId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  >
                    {completedPayments.map((payment) => (
                      <option value={payment.id} key={payment.id}>
                        {payment.provider} · {formatMoney(payment.amount, payment.currency_code, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-neutral-600">
                  {tFinanceControls(locale, 'refundAmount')}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundAmount}
                    onChange={(event) => setRefundAmount(event.target.value)}
                    placeholder="100.00"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </label>
                <label className="block text-xs font-bold text-neutral-600">
                  {tFinanceControls(locale, 'refundReason')}
                  <input
                    value={refundReason}
                    onChange={(event) => setRefundReason(event.target.value)}
                    required
                    minLength={3}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </label>
                <button
                  disabled={busy !== null || !refundPaymentId}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-800 disabled:opacity-50"
                >
                  {tFinanceControls(locale, 'requestRefund')}
                </button>
              </form>
            ) : null}

            {openRefunds.length > 0 ? (
              <form onSubmit={completeRefund} className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
                <label className="block text-xs font-bold text-neutral-600">
                  {tFinanceControls(locale, 'refundsTitle')}
                  <select
                    value={completeRefundId}
                    onChange={(event) => setCompleteRefundId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  >
                    {openRefunds.map((refund) => (
                      <option value={refund.id} key={refund.id}>
                        {formatMoney(refund.amount, refund.currency_code, locale)} · {refund.reason}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-neutral-600">
                  {tFinanceControls(locale, 'refundReference')}
                  <input
                    value={refundReference}
                    onChange={(event) => setRefundReference(event.target.value)}
                    required
                    minLength={3}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </label>
                <button
                  disabled={busy !== null || !completeRefundId}
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50"
                >
                  {tFinanceControls(locale, 'markRefundComplete')}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {canCancel && invoice.status !== 'canceled' ? (
          <form onSubmit={requestCancellation} className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-black text-neutral-900">
              {tFinanceControls(locale, 'cancellationTitle')}
            </h3>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {tFinanceControls(locale, 'cancellationCopy')}
            </p>
            {activeCancellation ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                {cancellationStatusLabel(activeCancellation.status, locale)}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-neutral-600">
                  {tFinanceControls(locale, 'cancellationReason')}
                  <textarea
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    required
                    minLength={3}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </label>
                <button
                  disabled={busy !== null}
                  className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
                >
                  {tFinanceControls(locale, 'cancelInvoice')}
                </button>
              </div>
            )}
          </form>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="bg-neutral-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-neutral-600">
            {tFinanceControls(locale, 'refundsTitle')} · {tFinanceControls(locale, 'history')}
          </div>
          {invoice.refunds.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">{tFinanceControls(locale, 'noRefunds')}</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {invoice.refunds.map((refund) => (
                <div className="p-4 text-sm" key={refund.id}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-neutral-900">
                      {formatMoney(refund.amount, refund.currency_code, locale)}
                    </strong>
                    <span className="text-xs font-bold uppercase text-neutral-600">
                      {refundStatusLabel(refund.status, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-700">{refund.reason}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {tFinanceControls(locale, 'requestedAt')}: {formatDateTime(refund.requested_at, locale)}
                    {refund.provider_refund_id ? ` · ${tFinanceControls(locale, 'reference')}: ${refund.provider_refund_id}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="bg-neutral-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-neutral-600">
            {tFinanceControls(locale, 'cancellationTitle')} · {tFinanceControls(locale, 'history')}
          </div>
          {invoice.cancellations.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">—</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {invoice.cancellations.map((cancellation) => (
                <div className="p-4 text-sm" key={cancellation.id}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-neutral-900">{cancellation.reason}</strong>
                    <span className="text-xs font-bold uppercase text-neutral-600">
                      {cancellationStatusLabel(cancellation.status, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {tFinanceControls(locale, 'requestedAt')}: {formatDateTime(cancellation.requested_at, locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
