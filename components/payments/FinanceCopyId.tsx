'use client'

import { useState } from 'react'
import { tFinanceObservability } from '@/Lib/i18n/financeObservability'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export default function FinanceCopyId({
  value,
  label,
}: {
  value: string | null | undefined
  label?: string
}) {
  const locale = useAuthLocaleFromMe()
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-neutral-400">—</span>

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <code className="truncate font-mono text-[11px] text-neutral-700" title={value}>
        {label ? `${label}: ` : ''}
        {value}
      </code>
      <button
        type="button"
        className="shrink-0 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          } catch {
            /* ignore */
          }
        }}
      >
        {copied ? tFinanceObservability(locale, 'copied') : tFinanceObservability(locale, 'copyId')}
      </button>
    </span>
  )
}
