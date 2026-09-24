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

type CopyKey =
  | 'loading'
  | 'success'
  | 'error'
  | 'sandbox'
  | 'buyer'
  | 'cancelled'
  | 'testBanner'
  | 'testSubtitle'
  | 'liveLoading'
  | 'liveSuccess'
  | 'liveError'
  | 'liveCancelled'
  | 'unavailable'

function copy(locale: string, key: CopyKey) {
  const lang = locale === 'en' || locale === 'es' ? locale : 'pt'
  const values = {
    loading: {
      pt: 'Carregando PayPal Sandbox…',
      en: 'Loading PayPal Sandbox…',
      es: 'Cargando PayPal Sandbox…',
    },
    success: {
      pt: 'Captura de TESTE registrada no Sandbox. Nenhum dinheiro foi recebido e a fatura continua em aberto.',
      en: 'Sandbox TEST capture recorded. No money was received and the invoice stays unpaid.',
      es: 'Captura de PRUEBA registrada en Sandbox. No se recibió dinero y la factura sigue pendiente.',
    },
    error: {
      pt: 'Não foi possível concluir o teste Sandbox. Tente novamente.',
      en: 'Could not complete the Sandbox test. Please try again.',
      es: 'No fue posible completar la prueba Sandbox. Inténtelo de nuevo.',
    },
    testBanner: {
      pt: 'TRANSAÇÕES DE TESTE — SEM DINHEIRO REAL',
      en: 'TEST TRANSACTIONS — NO REAL MONEY',
      es: 'TRANSACCIONES DE PRUEBA — SIN DINERO REAL',
    },
    testSubtitle: {
      pt: 'Visível apenas para a equipe interna logada. O cliente não vê este checkout.',
      en: 'Visible only to signed-in internal staff. Customers never see this checkout.',
      es: 'Visible solo para el equipo interno conectado. El cliente no ve este checkout.',
    },
    liveLoading: {
      pt: 'Carregando PayPal…',
      en: 'Loading PayPal…',
      es: 'Cargando PayPal…',
    },
    liveSuccess: {
      pt: 'Pagamento confirmado. Atualizando fatura…',
      en: 'Payment confirmed. Updating invoice…',
      es: 'Pago confirmado. Actualizando factura…',
    },
    liveError: {
      pt: 'Não foi possível concluir o pagamento. Tente novamente.',
      en: 'Could not complete the payment. Please try again.',
      es: 'No fue posible completar el pago. Inténtelo de nuevo.',
    },
    liveCancelled: {
      pt: 'Pagamento cancelado. Você pode tentar de novo.',
      en: 'Payment cancelled. You can try again.',
      es: 'Pago cancelado. Puede intentarlo de nuevo.',
    },
    unavailable: {
      pt: 'O PayPal está temporariamente indisponível. Use a forma de pagamento alternativa disponível.',
      en: 'PayPal is temporarily unavailable. Please use the available alternative payment method.',
      es: 'PayPal no está disponible temporalmente. Utilice el método de pago alternativo disponible.',
    },
    sandbox: {
      pt: 'Homologação interna — nenhum dinheiro real será movimentado.',
      en: 'Internal Sandbox validation — no real money will move.',
      es: 'Validación interna Sandbox — no se moverá dinero real.',
    },
    buyer: {
      pt: 'PayPal Sandbox — use uma conta de comprador Sandbox. Credenciais PayPal reais não funcionam neste ambiente.',
      en: 'PayPal Sandbox — use a Sandbox buyer account. Real PayPal credentials do not work in this environment.',
      es: 'PayPal Sandbox — use una cuenta de comprador Sandbox. Las credenciales reales de PayPal no funcionan en este entorno.',
    },
    cancelled: {
      pt: 'Pagamento Sandbox cancelado. Você pode tentar de novo.',
      en: 'Sandbox payment cancelled. You can try again.',
      es: 'Pago Sandbox cancelado. Puede intentarlo de nuevo.',
    },
  } as const
  return values[key][lang]
}

export default function PaypalSandboxCheckout({
  token,
  clientId,
  currency,
  locale,
  environment = 'sandbox',
}: {
  token: string
  clientId: string
  currency: string
  locale: string
  environment?: 'live' | 'sandbox'
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const renderedRef = useRef(false)
  const inflightRef = useRef(false)
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'success' | 'error' | 'cancelled' | 'unavailable'
  >('loading')
  const sandbox = environment !== 'live'

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
            if (inflightRef.current) throw new Error('paypal_in_flight')
            inflightRef.current = true
            try {
              const response = await fetch('/api/payments/paypal/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
              })
              const payload = (await response.json().catch(() => null)) as
                | { data?: { orderId?: string }; error?: string }
                | null
              if (!response.ok || !payload?.data?.orderId) {
                if (payload?.error === 'PAYPAL_LIVE_NOT_AVAILABLE') setStatus('unavailable')
                throw new Error(payload?.error || 'paypal_order_failed')
              }
              return payload.data.orderId
            } catch (error) {
              inflightRef.current = false
              throw error
            }
          },
          onApprove: async ({ orderID }) => {
            try {
              const response = await fetch('/api/payments/paypal/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, orderId: orderID }),
              })
              const payload = (await response.json().catch(() => null)) as
                | { data?: { invoiceStatus?: string }; error?: string }
                | null
              if (!response.ok) {
                if (payload?.error === 'PAYPAL_LIVE_NOT_AVAILABLE') setStatus('unavailable')
                throw new Error(payload?.error || 'paypal_capture_failed')
              }
              setStatus('success')
              if (!sandbox) window.setTimeout(() => window.location.reload(), 900)
            } finally {
              inflightRef.current = false
            }
          },
          onCancel: () => {
            inflightRef.current = false
            setStatus('cancelled')
          },
          onError: () => {
            inflightRef.current = false
            setStatus((current) => (current === 'unavailable' ? current : 'error'))
          },
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
  }, [clientId, currency, sandbox, token])

  if (status === 'unavailable') {
    return (
      <section
        data-paypal-unavailable
        className="rounded-2xl border border-[#e8e2d9] bg-white p-5 text-sm text-[#6b6560]"
      >
        {copy(locale, 'unavailable')}
      </section>
    )
  }

  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ${
        sandbox ? 'border-4 border-dashed border-amber-500' : 'border border-[#e8e2d9]'
      }`}
      data-paypal-sandbox-checkout={sandbox ? '' : undefined}
      data-paypal-environment={sandbox ? 'sandbox' : 'live'}
    >
      {sandbox ? (
        <div className="mb-4">
          <div
            data-testid="paypal-sandbox-test-banner"
            className="rounded-xl bg-amber-400 px-3 py-2 text-center text-amber-950"
          >
            <p className="text-sm font-black uppercase tracking-[0.18em]">PayPal Sandbox</p>
            <p className="text-xs font-black uppercase tracking-[0.12em]">{copy(locale, 'testBanner')}</p>
          </div>
          <p className="mt-2 text-sm text-[#6b6560]">{copy(locale, 'testSubtitle')}</p>
          <p
            data-testid="paypal-sandbox-buyer-notice"
            className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
          >
            {copy(locale, 'buyer')}
          </p>
        </div>
      ) : null}
      {status === 'loading' ? (
        <p className="text-sm text-[#6b6560]">{copy(locale, sandbox ? 'loading' : 'liveLoading')}</p>
      ) : null}
      {status === 'success' ? (
        <p
          data-testid={sandbox ? 'paypal-sandbox-test-recorded' : 'paypal-payment-confirmed'}
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            sandbox ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {copy(locale, sandbox ? 'success' : 'liveSuccess')}
        </p>
      ) : null}
      {status === 'cancelled' ? (
        <p
          data-testid="paypal-sandbox-cancelled"
          className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          {copy(locale, sandbox ? 'cancelled' : 'liveCancelled')}
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {copy(locale, sandbox ? 'error' : 'liveError')}
        </p>
      ) : null}
      <div ref={hostRef} aria-label={sandbox ? 'PayPal Sandbox test checkout' : 'PayPal checkout'} />
    </section>
  )
}
