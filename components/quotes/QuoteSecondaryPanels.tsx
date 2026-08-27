'use client'

import { useState, type ReactNode } from 'react'

export function QuoteSecondaryPanels({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-bold text-neutral-800 shadow-sm"
      >
        <span>{label}</span>
        <span aria-hidden className="text-neutral-400">
          +
        </span>
      </button>
    )
  }

  return <div className="mt-4">{children}</div>
}
