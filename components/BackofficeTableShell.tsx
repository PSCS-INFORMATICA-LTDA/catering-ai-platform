'use client'

import type { ReactNode } from 'react'
import BuildVersionBadge from '@/components/BuildVersionBadge'

type ActiveFilter = 'active' | 'all'

export default function BackofficeTableShell({
  title,
  subtitle,
  actions,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  activeFilter,
  onActiveFilterChange,
  showActiveFilter = true,
  onRefresh,
  loading,
  error,
  children,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  activeFilter?: ActiveFilter
  onActiveFilterChange?: (value: ActiveFilter) => void
  showActiveFilter?: boolean
  onRefresh: () => void
  loading?: boolean
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <BuildVersionBadge className="hidden sm:block" />

        <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-600 sm:text-4xl">{title}</h1>
            <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>

        <div className="mb-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-2">
              <span className="cdl-eyebrow">Buscar</span>
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </label>
            {showActiveFilter && onActiveFilterChange ? (
              <label className="flex flex-col gap-2 sm:w-48">
                <span className="cdl-eyebrow">Status</span>
                <select
                  value={activeFilter}
                  onChange={(e) =>
                    onActiveFilterChange(e.target.value as ActiveFilter)
                  }
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
                >
                  <option value="active">Ativos</option>
                  <option value="all">Todos</option>
                </select>
              </label>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-800 shadow-sm transition hover:border-neutral-300 disabled:opacity-50"
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-cdl-action">{error}</p> : null}
        </div>

        {children}
    </div>
  )
}
