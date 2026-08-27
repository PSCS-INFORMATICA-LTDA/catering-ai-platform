'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import DeleteQuoteButton from '@/components/DeleteQuoteButton'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

const QuotePdfDownload = dynamic(() => import('./QuotePdfDownload'), {
  loading: () => (
    <div className="h-12 min-w-[8rem] animate-pulse rounded-xl bg-neutral-100" />
  ),
})

export default function QuoteDetailToolbar({
  quoteId,
  quoteNumber,
  customerName,
  eventDate,
  editHref,
}: {
  quoteId: string
  quoteNumber: string
  customerName?: string | null
  eventDate?: string | null
  editHref?: string | null
}) {
  const locale = useAuthLocaleFromMe()

  function handlePrint() {
    const previousTitle = document.title
    document.title = `${quoteNumber} — Proposta BBQ At Home`
    window.print()
    document.title = previousTitle
  }

  return (
    <div className="no-print mb-8 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <Link
        href="/quotes"
        prefetch={false}
        className="inline-flex items-center text-sm text-cdl-muted transition-colors hover:text-cdl-brand"
      >
        ← {tQuotesOrders(locale, 'backToQuotes')}
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {editHref && (
          <Link
            href={editHref}
            prefetch={false}
            className="inline-flex items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-5 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border"
          >
            {tQuotesOrders(locale, 'editQuoteAction')}
          </Link>
        )}
        <button
          type="button"
          onClick={handlePrint}
          className="hidden items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-5 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border md:inline-flex"
        >
          {tQuotesOrders(locale, 'printPdfAction')}
        </button>
        <DeleteQuoteButton quoteId={quoteId} />
        <QuotePdfDownload
          quoteId={quoteId}
          quoteNumber={quoteNumber}
          customerName={customerName}
          eventDate={eventDate}
        />
      </div>
      </div>
    </div>
  )
}
