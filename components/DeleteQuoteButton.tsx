'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { glassBtn } from '@/Lib/liquidGlass'

export default function DeleteQuoteButton({
  quoteId,
  className = '',
  compact = false,
  redirectToList = true,
  onDeleted,
}: {
  quoteId: string
  className?: string
  compact?: boolean
  redirectToList?: boolean
  onDeleted?: (quoteId: string) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir esta cotação?',
    )
    if (!confirmed) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(result.error ?? 'Não foi possível excluir a cotação.')
        return
      }

      onDeleted?.(quoteId)

      if (redirectToList) {
        router.push('/quotes')
        router.refresh()
      }
    } catch {
      setError('Não foi possível excluir a cotação.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-stretch">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className={glassBtn(
          'danger',
          [
            compact
              ? '!min-h-[28px] !px-2 !py-1 !text-[10px]'
              : 'min-h-[40px] px-5 py-2.5 text-sm',
            className,
          ]
            .filter(Boolean)
            .join(' '),
        )}
      >
        {deleting ? 'Excluindo…' : compact ? 'Excluir' : 'Excluir Cotação'}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-cdl-action">{error}</p>
      ) : null}
    </div>
  )
}
