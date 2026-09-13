'use client'

import { useEffect, useMemo, useState } from 'react'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type Coupon = {
  code: string
  campaignName: string
  description: string | null
  manualApprovalRequired: boolean
  approvalStatus: 'pending' | 'applied'
  eligibleAmount: number
  potentialDiscountAmount: number
  appliedDiscountAmount: number
  totalAfterCoupon: number
  projectedTotalAfterApproval: number
}

type ApiResponse = {
  coupon?: Coupon | null
  reason?: string
  pricing?: { subtotal: number; total: number; deposit: number; balance: number }
}

const COPY = {
  pt: {
    eyebrow: 'Benefício comercial', title: 'Tem um cupom?', subtitle: 'Digite o código antes de enviar a cotação.',
    placeholder: 'EX.: CDL10', apply: 'Aplicar', checking: 'Validando…', remove: 'Remover cupom',
    applied: 'Cupom aplicado', pending: 'Aguardando aprovação',
    pendingText: 'O desconto aparece como previsto, mas só entra no pedido depois da aprovação comercial.',
    eligible: 'Base elegível', discount: 'Desconto', total: 'Total com cupom', projected: 'Total após aprovação', deposit: 'Sinal', balance: 'Saldo',
    invalid: 'Código inválido ou indisponível para esta cotação.', not_found: 'Cupom não encontrado.', inactive: 'Este cupom não está ativo.',
    not_started: 'Este cupom ainda não iniciou.', expired: 'Este cupom expirou.', weekday_not_allowed: 'Este cupom não vale para a data do evento.',
    package_not_allowed: 'Este pacote não participa da campanha.', minimum_not_reached: 'O valor mínimo da campanha ainda não foi atingido.',
    customer_not_eligible: 'Este cupom é exclusivo para clientes elegíveis.', usage_limit_reached: 'O limite de uso deste cupom já foi atingido.',
    nothing_eligible: 'Não há itens elegíveis para este cupom.', invalid_configuration: 'Este cupom precisa de revisão da equipe comercial.',
  },
  en: {
    eyebrow: 'Commercial benefit', title: 'Have a coupon?', subtitle: 'Enter the code before submitting your quote.',
    placeholder: 'E.G. CDL10', apply: 'Apply', checking: 'Checking…', remove: 'Remove coupon',
    applied: 'Coupon applied', pending: 'Pending approval',
    pendingText: 'The projected discount is shown now and becomes final after commercial approval.',
    eligible: 'Eligible amount', discount: 'Discount', total: 'Total with coupon', projected: 'Total after approval', deposit: 'Deposit', balance: 'Balance',
    invalid: 'Invalid code or unavailable for this quote.', not_found: 'Coupon not found.', inactive: 'This coupon is not active.',
    not_started: 'This coupon has not started yet.', expired: 'This coupon has expired.', weekday_not_allowed: 'This coupon is not valid for the event date.',
    package_not_allowed: 'This package is not part of the campaign.', minimum_not_reached: 'The campaign minimum has not been reached yet.',
    customer_not_eligible: 'This coupon is limited to eligible customers.', usage_limit_reached: 'This coupon usage limit has been reached.',
    nothing_eligible: 'There are no eligible items for this coupon.', invalid_configuration: 'This coupon needs commercial review.',
  },
  es: {
    eyebrow: 'Beneficio comercial', title: '¿Tienes un cupón?', subtitle: 'Ingresa el código antes de enviar la cotización.',
    placeholder: 'EJ.: CDL10', apply: 'Aplicar', checking: 'Validando…', remove: 'Quitar cupón',
    applied: 'Cupón aplicado', pending: 'Pendiente de aprobación',
    pendingText: 'El descuento previsto se muestra ahora y se vuelve definitivo después de la aprobación comercial.',
    eligible: 'Base elegible', discount: 'Descuento', total: 'Total con cupón', projected: 'Total después de aprobación', deposit: 'Seña', balance: 'Saldo',
    invalid: 'Código inválido o no disponible para esta cotización.', not_found: 'Cupón no encontrado.', inactive: 'Este cupón no está activo.',
    not_started: 'Este cupón aún no comenzó.', expired: 'Este cupón venció.', weekday_not_allowed: 'Este cupón no aplica para la fecha del evento.',
    package_not_allowed: 'Este paquete no participa en la campaña.', minimum_not_reached: 'Todavía no se alcanzó el mínimo de la campaña.',
    customer_not_eligible: 'Este cupón es exclusivo para clientes elegibles.', usage_limit_reached: 'Ya se alcanzó el límite de uso de este cupón.',
    nothing_eligible: 'No hay ítems elegibles para este cupón.', invalid_configuration: 'Este cupón necesita revisión comercial.',
  },
} as const

function formatMoney(value: number, currency: string, language: QuoteLanguage) {
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(Number(value || 0))
}

export default function PublicCouponBox({ language, currency, onPricingRefresh }: { language: QuoteLanguage; currency: string; onPricingRefresh: () => void }) {
  const copy = COPY[language]
  const [code, setCode] = useState('')
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [pricing, setPricing] = useState<ApiResponse['pricing']>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const money = useMemo(() => (value: number) => formatMoney(value, currency, language), [currency, language])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/public/coupons/preview', { method: 'GET', cache: 'no-store', signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as ApiResponse) : null))
      .then((result) => {
        if (!result?.coupon) return
        setCoupon(result.coupon)
        setPricing(result.pricing)
        setCode(result.coupon.code)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [])

  async function send(nextCode: string) {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/public/coupons/preview', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: nextCode }),
      })
      const result = (await response.json().catch(() => null)) as ApiResponse | null
      if (!response.ok || (nextCode && !result?.coupon)) {
        const reason = result?.reason as keyof typeof copy | undefined
        setError(reason && typeof copy[reason] === 'string' ? copy[reason] : copy.invalid)
        return
      }
      setCoupon(result?.coupon ?? null)
      setPricing(result?.pricing)
      if (result?.coupon) setCode(result.coupon.code)
      else setCode('')
      onPricingRefresh()
    } catch {
      setError(copy.invalid)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section data-public-coupon-box className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-surface shadow-cdl">
      <div className="border-b border-cdl-border bg-gradient-to-r from-amber-50 via-cdl-surface to-cdl-surface px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl" aria-hidden>🎟️</div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">{copy.eyebrow}</p>
            <h3 className="mt-0.5 text-lg font-black text-cdl-title">{copy.title}</h3>
            <p className="mt-1 text-xs leading-5 text-cdl-muted">{copy.subtitle}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            disabled={loading}
            autoComplete="off"
            aria-label={copy.title}
            placeholder={copy.placeholder}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32))
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void send(code.trim())
              }
            }}
            className="min-h-12 flex-1 rounded-xl border border-cdl-border bg-cdl-bg px-4 text-sm font-black uppercase tracking-[0.12em] text-cdl-title outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/15 disabled:opacity-60"
          />
          <button type="button" disabled={loading || !code.trim()} onClick={() => void send(code.trim())} className="min-h-12 rounded-xl bg-cdl-title px-5 text-sm font-black text-cdl-bg disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? copy.checking : copy.apply}
          </button>
        </div>
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800">{error}</p> : null}
        {coupon ? (
          <div className={`rounded-2xl border p-4 ${coupon.manualApprovalRequired ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">{coupon.code}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${coupon.manualApprovalRequired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}`}>
                    {coupon.manualApprovalRequired ? copy.pending : copy.applied}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-cdl-title">{coupon.campaignName}</p>
                {coupon.description ? <p className="mt-1 max-w-2xl text-xs leading-5 text-cdl-muted">{coupon.description}</p> : null}
              </div>
              <button type="button" disabled={loading} onClick={() => void send('')} className="text-xs font-bold text-cdl-muted underline underline-offset-2 hover:text-cdl-title">{copy.remove}</button>
            </div>
            {coupon.manualApprovalRequired ? <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">{copy.pendingText}</p> : null}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{copy.eligible}</dt><dd className="mt-1 font-black text-cdl-title">{money(coupon.eligibleAmount)}</dd></div>
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{copy.discount}</dt><dd className="mt-1 font-black text-emerald-700">−{money(coupon.potentialDiscountAmount)}</dd></div>
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{coupon.manualApprovalRequired ? copy.projected : copy.total}</dt><dd className="mt-1 font-black text-cdl-title">{money(coupon.manualApprovalRequired ? coupon.projectedTotalAfterApproval : coupon.totalAfterCoupon)}</dd></div>
              <div className="rounded-xl bg-white/70 p-3"><dt className="font-semibold text-cdl-muted">{copy.deposit}</dt><dd className="mt-1 font-black text-cdl-title">{money(pricing?.deposit ?? 0)}</dd>{!coupon.manualApprovalRequired ? <p className="mt-1 text-[10px] font-semibold text-cdl-muted">{copy.balance}: {money(pricing?.balance ?? 0)}</p> : null}</div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  )
}
