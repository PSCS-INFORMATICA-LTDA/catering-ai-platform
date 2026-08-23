'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
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
  const locale = useAuthLocaleFromMe()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(tQuotesOrders(locale, 'deleteQuoteConfirm'))
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
        setError(result.error ?? tQuotesOrders(locale, 'deleteQuoteError'))
        return
      }

      onDeleted?.(quoteId)

      if (redirectToList) {
        router.push('/quotes')
        router.refresh()
      }
    } catch {
      setError(tQuotesOrders(locale, 'deleteQuoteError'))
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
        {deleting
          ? tQuotesOrders(locale, 'deleting')
          : compact
            ? tQuotesOrders(locale, 'delete')
            : tQuotesOrders(locale, 'deleteQuote')}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-cdl-action">{error}</p>
      ) : null}
    </div>
  )
}
