'use client'

import type { ReactNode } from 'react'

export default function InventoryPageShell({
  title,
  subtitle,
  error,
  children,
  actions,
}: {
  title: string
  subtitle?: string
  error?: string | null
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 text-cdl-fg sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="max-w-3xl text-sm text-cdl-muted">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {children}
    </main>
  )
}
