'use client'

import { useState } from 'react'
import { useAuthLocaleFromMe } from '../../../Lib/i18n/useAuthLocaleFromMe'
import { tw } from '../../../Lib/quoteTranslations'
import {
  getQuotePdfFilename,
  parseFilenameFromContentDisposition,
} from '../../../Lib/quotePdfFilename'

type QuotePdfDownloadProps = {
  quoteId: string
  quoteNumber: string
  customerName?: string | null
  eventDate?: string | null
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

async function savePdfBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace(/\.pdf$/i, ''),
      })
      return
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') {
        return
      }
    }
  }

  const url = URL.createObjectURL(blob)

  if (isMobileDevice()) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }
  }

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.type = 'application/pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function QuotePdfDownload({
  quoteId,
  quoteNumber,
  customerName,
  eventDate,
}: QuotePdfDownloadProps) {
  const locale = useAuthLocaleFromMe()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/quotes/${quoteId}/pdf`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(tw(locale, 'pdfFailed'))
      }

      const blob = await response.blob()
      const headerFilename = parseFilenameFromContentDisposition(
        response.headers.get('Content-Disposition'),
      )
      const filename =
        headerFilename ??
        getQuotePdfFilename({
          quote_number: quoteNumber,
          ab_name: customerName,
          event_date: eventDate,
        })

      await savePdfBlob(blob, filename)
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : tw(locale, 'pdfDownloadError'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="cdl-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? tw(locale, 'generatingPdf') : tw(locale, 'downloadPdf')}
      </button>
      {error ? (
        <p className="text-center text-xs text-red-400 sm:text-left">{error}</p>
      ) : null}
    </div>
  )
}
