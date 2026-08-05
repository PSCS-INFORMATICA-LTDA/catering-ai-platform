'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceOrderId, setServiceOrderId] = useState<string | null>(
    convertedServiceOrderId ?? null,
  )

  if (!canConvert) return null
  if (proposalResponse !== 'accepted' && !serviceOrderId) return null

  async function handleConvert() {
    if (
      !window.confirm(
        `Converter a cotação ${quoteNumber ?? ''} em Ordem de Serviço? Esta ação fica registrada e não pode ser desfeita.`,
      )
    ) {
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
        throw new Error(result.error ?? 'Não foi possível converter a cotação.')
      }
      if (result.data?.id) {
        setServiceOrderId(result.data.id)
        router.push(`/orders/${result.data.id}`)
      }
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : 'Não foi possível converter a cotação.',
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
            Ordem de Serviço
          </h2>
          <p className="mt-1 text-sm text-cdl-muted">
            {serviceOrderId
              ? 'Esta cotação já foi convertida em uma Ordem de Serviço operacional.'
              : 'Cliente aceitou a proposta. Confirme a conversão para gerar a Ordem de Serviço operacional.'}
          </p>
        </div>
      </div>

      {serviceOrderId ? (
        <Link href={`/orders/${serviceOrderId}`} className={glassBtn('secondary')}>
          Ver Ordem de Serviço
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void handleConvert()}
          disabled={busy}
          className={glassBtn('primary')}
        >
          {busy ? 'Convertendo…' : 'Converter em Ordem de Serviço'}
        </button>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </section>
  )
}
