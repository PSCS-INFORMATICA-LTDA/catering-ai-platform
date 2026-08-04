'use client'

import Link from 'next/link'
import DeleteQuoteButton from '@/components/DeleteQuoteButton'
import QuotePdfDownload from './QuotePdfDownload'

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
        className="inline-flex items-center text-sm text-cdl-muted transition-colors hover:text-cdl-brand"
      >
        ← Voltar às cotações
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {editHref && (
          <Link
            href={editHref}
            className="inline-flex items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-5 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border"
          >
            Editar cotação
          </Link>
        )}
        <button
          type="button"
          onClick={handlePrint}
          className="hidden items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-5 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border md:inline-flex"
        >
          Imprimir / PDF
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
