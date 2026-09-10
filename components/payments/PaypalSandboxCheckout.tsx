'use client'

import { useEffect, useRef, useState } from 'react'

type PaypalButtonsApi = {
  render: (selector: string | HTMLElement) => Promise<void>
  close?: () => void
}

type PaypalNamespace = {
  Buttons: (options: {
    style?: Record<string, unknown>
    createOrder: () => Promise<string>
    onApprove: (data: { orderID: string }) => Promise<void>
    onCancel?: () => void
    onError?: () => void
  }) => PaypalButtonsApi
}

declare global {
  interface Window {
    paypal?: PaypalNamespace
  }
}

function copy(locale: string, key: 'loading' | 'success' | 'error' | 'sandbox') {
  const lang = locale === 'en' || locale === 'es' ? locale : 'pt'
  const values = {
    loading: {
      pt: 'Carregando PayPal Sandbox…',
      en: 'Loading PayPal Sandbox…',
      es: 'Cargando PayPal Sandbox…',
    },
    success: {
      pt: 'Pagamento Sandbox confirmado. Atualizando fatura…',
      en: 'Sandbox payment confirmed. Updating invoice…',
      es: 'Pago Sandbox confirmado. Actualizando factura…',
    },
    error: {
      pt: 'Não foi possível concluir o pagamento Sandbox. Tente novamente.',
      en: 'Could not complete the Sandbox payment. Please try again.',
      es: 'No fue posible completar el pago Sandbox. Inténtelo de nuevo.',
    },
    sandbox: {
      pt: 'Homologação interna — nenhum dinheiro real será movimentado.',
      en: 'Internal Sandbox validation — no real money will move.',
      es: 'Validación interna Sandbox — no se moverá dinero real.',
    },
  } as const
  return values[key][lang]
}

export default function PaypalSandboxCheckout({
  token,
  clientId,
  currency,
  locale,
}: {
  token: string
  clientId: string
  currency: string
  locale: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const renderedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let buttons: PaypalButtonsApi | null = null

    async function mount() {
      try {
        const existing = document.querySelector<HTMLScriptElement>('script[data-pscs-paypal-sdk="sandbox"]')
        if (!existing) {
          const script = document.createElement('script')
          script.dataset.pscsPaypalSdk = 'sandbox'
          script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`
          script.async = true
          script.referrerPolicy = 'strict-origin-when-cross-origin'
          document.head.appendChild(script)
          await new Promise<void>((resolve, reject) => {
            script.addEventListener('load', () => resolve(), { once: true })
            script.addEventListener('error', () => reject(new Error('paypal_sdk_load_failed')), {
              once: true,
            })
          })
        } else if (!window.paypal) {
          await new Promise<void>((resolve, reject) => {
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error('paypal_sdk_load_failed')), {
              once: true,
            })
          })
        }

        if (cancelled || renderedRef.current || !hostRef.current || !window.paypal) return
        renderedRef.current = true
        buttons = window.paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
          createOrder: async () => {
            const response = await fetch('/api/payments/paypal/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            })
            const payload = (await response.json().catch(() => null)) as
              | { data?: { orderId?: string }; error?: string }
              | null
            if (!response.ok || !payload?.data?.orderId) {
              throw new Error(payload?.error || 'paypal_order_failed')
            }
            return payload.data.orderId
          },
          onApprove: async ({ orderID }) => {
            const response = await fetch('/api/payments/paypal/capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, orderId: orderID }),
            })
            const payload = (await response.json().catch(() => null)) as
              | { data?: { invoiceStatus?: string }; error?: string }
              | null
            if (!response.ok) throw new Error(payload?.error || 'paypal_capture_failed')
            setStatus('success')
            window.setTimeout(() => window.location.reload(), 900)
          },
          onCancel: () => setStatus('ready'),
          onError: () => setStatus('error'),
        })
        await buttons.render(hostRef.current)
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void mount()
    return () => {
      cancelled = true
      buttons?.close?.()
    }
  }, [clientId, currency, token])

  return (
    <section className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm" data-paypal-sandbox-checkout>
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c1121f]">PayPal Sandbox</p>
        <p className="mt-1 text-sm text-[#6b6560]">{copy(locale, 'sandbox')}</p>
      </div>
      {status === 'loading' ? <p className="text-sm text-[#6b6560]">{copy(locale, 'loading')}</p> : null}
      {status === 'success' ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {copy(locale, 'success')}
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {copy(locale, 'error')}
        </p>
      ) : null}
      <div ref={hostRef} aria-label="PayPal Sandbox checkout" />
    </section>
  )
}
