'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { glassBtn } from '@/Lib/liquidGlass'

export default function QuoteConvertPanel({
  quoteId,
  quoteNumber,
  proposalResponse,
  convertedServiceOrderId,
  canConvert,
}: {
  quoteId: string
  quoteNumber?: string | null
  proposalResponse?: string | null
  convertedServiceOrderId?: string | null
  canConvert: boolean
}) {
  const router = useRouter()
  const locale = useAuthLocaleFromMe()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceOrderId, setServiceOrderId] = useState<string | null>(
    convertedServiceOrderId ?? null,
  )

  if (!canConvert) return null
  if (proposalResponse !== 'accepted' && !serviceOrderId) return null

  async function handleConvert() {
    const confirmMessage = quoteNumber
      ? `${tQuotesOrders(locale, 'convertConfirm')} (${quoteNumber})`
      : tQuotesOrders(locale, 'convertConfirm')
    if (!window.confirm(confirmMessage)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/quotes/${quoteId}/convert`, {
        method: 'POST',
      })
      const result = (await response.json()) as {
        data?: { id: string; service_order_number: string }
        error?: string
      }
      if (!response.ok) {
        throw new Error(result.error ?? tQuotesOrders(locale, 'fetchQuotesError'))
      }
      if (result.data?.id) {
        setServiceOrderId(result.data.id)
        router.push(`/orders/${result.data.id}`)
      }
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : tQuotesOrders(locale, 'fetchQuotesError'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="no-print liquid-glass-card mt-4 space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'orderTitle')}
          </h2>
          <p className="mt-1 text-sm text-cdl-muted">
            {serviceOrderId
              ? tQuotesOrders(locale, 'convertedDescription')
              : tQuotesOrders(locale, 'convertPendingDescription')}
          </p>
        </div>
      </div>

      {serviceOrderId ? (
        <Link href={`/orders/${serviceOrderId}`} className={glassBtn('secondary')}>
          {tQuotesOrders(locale, 'viewServiceOrder')}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void handleConvert()}
          disabled={busy}
          className={glassBtn('primary')}
        >
          {busy ? tQuotesOrders(locale, 'converting') : tQuotesOrders(locale, 'convert')}
        </button>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </section>
  )
}
