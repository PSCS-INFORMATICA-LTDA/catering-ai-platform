'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { tEventFinancialCloseout } from '@/Lib/i18n/eventFinancialCloseout'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { glassBtn, glassField } from '@/Lib/liquidGlass'
import type {
  EventFinancialCloseoutView,
  EventCloseoutExtraServiceInput,
} from '@/Lib/payments/eventFinancialCloseout'

type ExtraDraft = EventCloseoutExtraServiceInput & { key: string }

function money(value: number, currency: string, locale: string | null | undefined) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

function statusLabel(status: EventFinancialCloseoutView['status'], locale: string | null | undefined) {
  if (status === 'invoiced') return tEventFinancialCloseout(locale, 'statusInvoiced')
  if (status === 'closed_no_charge') return tEventFinancialCloseout(locale, 'statusNoCharge')
  if (status === 'ready_for_review') return tEventFinancialCloseout(locale, 'statusReview')
  return tEventFinancialCloseout(locale, 'statusDraft')
}

function lineTypeLabel(type: ExtraDraft['line_type'], locale: string | null | undefined) {
  if (type === 'overtime') return tEventFinancialCloseout(locale, 'typeOvertime')
  if (type === 'equipment') return tEventFinancialCloseout(locale, 'typeEquipment')
  if (type === 'damage') return tEventFinancialCloseout(locale, 'typeDamage')
  if (type === 'other') return tEventFinancialCloseout(locale, 'typeOther')
  return tEventFinancialCloseout(locale, 'typeExtraService')
}

function closeoutErrorMessage(code: string, locale: string | null | undefined) {
  if (code === 'service_order_must_be_completed') {
    return tEventFinancialCloseout(locale, 'completeOrderFirst')
  }
  if (code === 'guest_overage_pricing_missing') {
    return tEventFinancialCloseout(locale, 'pricingMissing')
  }
  if (code === 'original_invoice_canceled') {
    return tEventFinancialCloseout(locale, 'originalInvoiceCanceled')
  }
  return `${tEventFinancialCloseout(locale, 'error')} (${code})`
}

export default function EventFinancialCloseoutPanel({
  orderId,
  canManage,
}: {
  orderId: string
  canManage: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [data, setData] = useState<EventFinancialCloseoutView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [adults, setAdults] = useState('0')
  const [childrenUnder3, setChildrenUnder3] = useState('0')
  const [children4To12, setChildren4To12] = useState('0')
  const [notes, setNotes] = useState('')
  const [extras, setExtras] = useState<ExtraDraft[]>([])
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const hydrateForm = useCallback((next: EventFinancialCloseoutView) => {
    setData(next)
    setAdults(String(next.final.adults ?? next.contracted.adults))
    setChildrenUnder3(String(next.final.children_under_3 ?? next.contracted.children_under_3))
    setChildren4To12(String(next.final.children_4_to_12 ?? next.contracted.children_4_to_12))
    setNotes(next.notes ?? '')
    setExtras(
      next.lines
        .filter((line) => line.line_type !== 'guest_overage')
        .map((line, index) => ({
          key: `${line.id}-${index}`,
          line_type: line.line_type as ExtraDraft['line_type'],
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
        })),
    )
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/orders/${orderId}/financial-closeout`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as {
        data?: EventFinancialCloseoutView
        error?: string
      } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || `HTTP ${response.status}`)
      hydrateForm(payload.data)
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown_error'
      setError(closeoutErrorMessage(code, locale))
    } finally {
      setLoading(false)
    }
  }, [hydrateForm, locale, orderId])

  useEffect(() => {
    void load()
  }, [load])

  const finalPhysical = useMemo(
    () => Math.max(0, Number(adults) || 0) + Math.max(0, Number(childrenUnder3) || 0) + Math.max(0, Number(children4To12) || 0),
    [adults, childrenUnder3, children4To12],
  )
  const finalBillable = useMemo(
    () => Math.round((Math.max(0, Number(adults) || 0) + Math.max(0, Number(children4To12) || 0) * 0.5) * 100) / 100,
    [adults, children4To12],
  )
  const finalized = data?.status === 'invoiced' || data?.status === 'closed_no_charge' || data?.status === 'void'
  const originalOutstanding = useMemo(
    () => Math.max(0, Math.round(((data?.original_invoice?.total || 0) - (data?.original_invoice?.paid_total || 0)) * 100) / 100),
    [data?.original_invoice?.paid_total, data?.original_invoice?.total],
  )

  function addExtra() {
    setExtras((current) => [
      ...current,
      {
        key: `draft-${Date.now()}-${current.length}`,
        line_type: 'extra_service',
        description: '',
        quantity: 1,
        unit_price: 0,
      },
    ])
  }

  function updateExtra(index: number, patch: Partial<ExtraDraft>) {
    setExtras((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeExtra(index: number) {
    setExtras((current) => current.filter((_, i) => i !== index))
  }

  async function saveCloseout() {
    setBusy(true)
    setError(null)
    setHint(null)
    setPaymentLink(null)
    try {
      const response = await fetch(`/api/orders/${orderId}/financial-closeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalAdults: Number(adults),
          finalChildrenUnder3: Number(childrenUnder3),
          finalChildren4To12: Number(children4To12),
          extraServices: extras.map(({ key: _key, ...row }) => row),
          notes,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        data?: EventFinancialCloseoutView
        error?: string
      } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || `HTTP ${response.status}`)
      hydrateForm(payload.data)
      setHint(tEventFinancialCloseout(locale, 'saved'))
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown_error'
      setError(closeoutErrorMessage(code, locale))
    } finally {
      setBusy(false)
    }
  }

  async function finalizeCloseout() {
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      // The database checks the Service Order status at this exact moment. We do
      // not disable this action based on cached client state, so a just-completed
      // order can be finalized without a page reload.
      const response = await fetch(`/api/orders/${orderId}/financial-closeout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const payload = (await response.json().catch(() => null)) as {
        data?: EventFinancialCloseoutView
        error?: string
      } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || `HTTP ${response.status}`)
      hydrateForm(payload.data)
      setHint(
        payload.data.status === 'closed_no_charge'
          ? tEventFinancialCloseout(locale, 'noCharge')
          : tEventFinancialCloseout(locale, 'finalized'),
      )
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown_error'
      setError(closeoutErrorMessage(code, locale))
    } finally {
      setBusy(false)
    }
  }

  async function createPaymentLink() {
    if (!data?.supplemental_invoice) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/invoices/${data.supplemental_invoice.id}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'full' }),
      })
      const payload = (await response.json().catch(() => null)) as {
        data?: { url?: string }
        error?: string
      } | null
      if (!response.ok || !payload?.data?.url) throw new Error(payload?.error || `HTTP ${response.status}`)
      setPaymentLink(payload.data.url)
      setHint(tEventFinancialCloseout(locale, 'paymentLinkCreated'))
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown_error'
      setError(closeoutErrorMessage(code, locale))
    } finally {
      setBusy(false)
    }
  }

  async function copyPaymentLink() {
    if (!paymentLink) return
    await navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return (
      <section className="liquid-glass-card p-5 text-sm text-cdl-muted">
        {tEventFinancialCloseout(locale, 'loading')}
      </section>
    )
  }
  if (!data) {
    return (
      <section className="liquid-glass-card p-5 text-sm text-red-500">
        {error || tEventFinancialCloseout(locale, 'error')}
      </section>
    )
  }

  return (
    <section className="liquid-glass-card space-y-5 p-5" data-event-financial-closeout>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-cdl-fg">{tEventFinancialCloseout(locale, 'title')}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-cdl-muted">
            {tEventFinancialCloseout(locale, 'subtitle')}
          </p>
        </div>
        <span className="rounded-full border border-cdl-border bg-cdl-inset px-3 py-1 text-xs font-bold uppercase tracking-wide text-cdl-muted">
          {statusLabel(data.status, locale)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-cdl-border bg-cdl-inset p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-cdl-muted">
            {tEventFinancialCloseout(locale, 'contracted')}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label={tEventFinancialCloseout(locale, 'adults')} value={data.contracted.adults} />
            <Metric label={tEventFinancialCloseout(locale, 'children4To12')} value={data.contracted.children_4_to_12} />
            <Metric label={tEventFinancialCloseout(locale, 'childrenUnder3')} value={data.contracted.children_under_3} />
            <Metric label={tEventFinancialCloseout(locale, 'billableGuests')} value={data.contracted.billable_guests} />
          </div>
        </div>

        <div className="rounded-2xl border border-cdl-border bg-cdl-inset p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-cdl-muted">
            {tEventFinancialCloseout(locale, 'actual')}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField label={tEventFinancialCloseout(locale, 'adults')} value={adults} onChange={setAdults} disabled={!canManage || finalized} />
            <NumberField label={tEventFinancialCloseout(locale, 'children4To12')} value={children4To12} onChange={setChildren4To12} disabled={!canManage || finalized} />
            <NumberField label={tEventFinancialCloseout(locale, 'childrenUnder3')} value={childrenUnder3} onChange={setChildrenUnder3} disabled={!canManage || finalized} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-cdl-muted">
            <span>Total físico: <strong className="text-cdl-fg">{finalPhysical}</strong></span>
            <span>{tEventFinancialCloseout(locale, 'billableGuests')}: <strong className="text-cdl-fg">{finalBillable}</strong></span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-cdl-muted">
            {tEventFinancialCloseout(locale, 'extraServices')}
          </h3>
          {canManage && !finalized ? (
            <button type="button" className={glassBtn('secondary')} onClick={addExtra} disabled={busy}>
              {tEventFinancialCloseout(locale, 'addLine')}
            </button>
          ) : null}
        </div>
        {extras.map((row, index) => (
          <div key={row.key} className="grid gap-2 rounded-xl border border-cdl-border p-3 md:grid-cols-[10rem_minmax(0,1fr)_7rem_9rem_auto]">
            <select
              className={glassField()}
              value={row.line_type}
              disabled={!canManage || finalized}
              onChange={(event) => updateExtra(index, { line_type: event.target.value as ExtraDraft['line_type'] })}
            >
              {(['extra_service', 'overtime', 'equipment', 'damage', 'other'] as const).map((type) => (
                <option key={type} value={type}>{lineTypeLabel(type, locale)}</option>
              ))}
            </select>
            <input
              className={glassField()}
              placeholder={tEventFinancialCloseout(locale, 'description')}
              value={row.description}
              disabled={!canManage || finalized}
              onChange={(event) => updateExtra(index, { description: event.target.value })}
            />
            <input
              className={glassField()}
              type="number"
              min="0.01"
              step="0.01"
              aria-label={tEventFinancialCloseout(locale, 'quantity')}
              value={row.quantity}
              disabled={!canManage || finalized}
              onChange={(event) => updateExtra(index, { quantity: Number(event.target.value) })}
            />
            <input
              className={glassField()}
              type="number"
              min="0"
              step="0.01"
              aria-label={tEventFinancialCloseout(locale, 'unitPrice')}
              value={row.unit_price}
              disabled={!canManage || finalized}
              onChange={(event) => updateExtra(index, { unit_price: Number(event.target.value) })}
            />
            {canManage && !finalized ? (
              <button type="button" className={glassBtn('ghost')} onClick={() => removeExtra(index)} disabled={busy}>×</button>
            ) : null}
          </div>
        ))}
      </div>

      {canManage && !finalized ? (
        <label className="block text-xs font-bold text-cdl-muted">
          {tEventFinancialCloseout(locale, 'notes')}
          <textarea className={`${glassField()} mt-1 w-full`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      ) : null}

      <p className="rounded-xl border border-cdl-warning-border bg-cdl-warning-soft px-3 py-2 text-xs leading-5 text-cdl-warning">
        {tEventFinancialCloseout(locale, 'noAutomaticCredit')}
      </p>

      {data.lines.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-cdl-border">
          <div className="bg-cdl-inset px-4 py-3 text-xs font-black uppercase tracking-wide text-cdl-muted">
            {tEventFinancialCloseout(locale, 'detailedAdjustment')}
          </div>
          <div className="divide-y divide-cdl-border">
            {data.lines.map((line) => (
              <div key={line.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <strong className="text-cdl-fg">{line.description}</strong>
                  <p className="text-xs text-cdl-muted">{line.quantity} × {money(line.unit_price, data.currency_code, locale)}</p>
                </div>
                <strong className="text-cdl-fg">{money(line.amount, data.currency_code, locale)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MoneyMetric label={tEventFinancialCloseout(locale, 'originalTotal')} value={data.original_invoice?.total || 0} currency={data.currency_code} locale={locale} />
        <MoneyMetric label={tEventFinancialCloseout(locale, 'originalOutstanding')} value={originalOutstanding} currency={data.currency_code} locale={locale} />
        <MoneyMetric label={tEventFinancialCloseout(locale, 'guestOverageTotal')} value={data.guest_overage_total} currency={data.currency_code} locale={locale} />
        <MoneyMetric label={tEventFinancialCloseout(locale, 'extrasTotal')} value={data.extra_services_total} currency={data.currency_code} locale={locale} />
        <MoneyMetric label={tEventFinancialCloseout(locale, 'finalEventTotal')} value={data.final_event_total} currency={data.currency_code} locale={locale} strong />
      </div>

      {originalOutstanding > 0 && data.supplemental_invoice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {tEventFinancialCloseout(locale, 'originalBalanceNotice')}
        </p>
      ) : null}

      {data.original_invoice ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="font-bold text-[var(--brand-primary-2)] hover:underline" href={`/invoices/${data.original_invoice.id}`}>
            {tEventFinancialCloseout(locale, 'originalInvoice')}: {data.original_invoice.invoice_number}
          </Link>
          {data.supplemental_invoice ? (
            <Link className="font-bold text-[var(--brand-primary-2)] hover:underline" href={`/invoices/${data.supplemental_invoice.id}`}>
              {tEventFinancialCloseout(locale, 'supplementalInvoice')}: {data.supplemental_invoice.invoice_number}
            </Link>
          ) : null}
        </div>
      ) : null}

      {hint ? <p className="text-sm font-semibold text-emerald-700">{hint}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-500">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canManage && !finalized ? (
          <button type="button" className={glassBtn('primary')} disabled={busy} onClick={() => void saveCloseout()}>
            {tEventFinancialCloseout(locale, 'recalculate')}
          </button>
        ) : null}
        {canManage && data.status === 'ready_for_review' ? (
          <button type="button" className={glassBtn('secondary')} disabled={busy} onClick={() => void finalizeCloseout()}>
            {tEventFinancialCloseout(locale, 'finalize')}
          </button>
        ) : null}
        {data.supplemental_invoice && data.supplemental_invoice.status !== 'paid' ? (
          <button type="button" className={glassBtn('secondary')} disabled={busy} onClick={() => void createPaymentLink()}>
            {tEventFinancialCloseout(locale, 'createPaymentLink')}
          </button>
        ) : null}
      </div>

      {paymentLink ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="break-all text-sm text-emerald-900">{paymentLink}</p>
          <button type="button" className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-800" onClick={() => void copyPaymentLink()}>
            {copied ? tEventFinancialCloseout(locale, 'copied') : tEventFinancialCloseout(locale, 'copyLink')}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-cdl-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-cdl-fg">{value}</p>
    </div>
  )
}

function MoneyMetric({ label, value, currency, locale, strong = false }: { label: string; value: number; currency: string; locale: string | null | undefined; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-cdl-inset p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-cdl-muted">{label}</p>
      <p className={`mt-1 text-lg ${strong ? 'font-black' : 'font-bold'} text-cdl-fg`}>{money(value, currency, locale)}</p>
    </div>
  )
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label className="text-xs font-bold text-cdl-muted">
      {label}
      <input className={`${glassField()} mt-1 w-full`} type="number" min="0" step="1" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
