'use client'

import type { ReactNode } from 'react'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export function BackofficeSectionBlock({
  title,
  count,
  codes,
  badge,
  children,
}: {
  title: string
  count: number
  codes: string[]
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-red-600">{title}</h2>
            {badge}
          </div>
          <BackofficePackageCount count={count} />
          {codes.length > 0 ? (
            <p className="mt-2 text-xs font-medium text-neutral-400">
              {codes.join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {codes.map((code) => (
          <span
            key={code}
            className="inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm"
          >
            {code}
          </span>
        ))}
      </div>
      {children}
    </section>
  )
}

export function BackofficeFormSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-full border-b border-neutral-100 pb-2 text-sm font-bold uppercase tracking-wider text-red-600">
      {children}
    </h3>
  )
}

export function BackofficeTextarea({
  value,
  onChange,
  rows = 3,
}: {
  value: string | number | boolean | null | undefined
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <textarea
      value={value == null ? '' : String(value)}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
    />
  )
}

function BackofficePackageCount({ count }: { count: number }) {
  const locale = useAuthLocaleFromMe()
  return (
    <p className="mt-1 text-sm text-neutral-500">
      {count}{' '}
      {count === 1
        ? tCommon(locale, 'packageSingular')
        : tCommon(locale, 'packages')}
    </p>
  )
}

export function BackofficeInventoryButton({
  source,
  id,
}: {
  source: 'package' | 'additional_item'
  id: string
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <button
      type="button"
      title={tCommon(locale, 'inventorySoon')}
      onClick={() => {
        window.alert(tCommon(locale, 'inventorySoon'))
        void source
        void id
      }}
      className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-2 text-sm font-bold text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-100"
    >
      {tCommon(locale, 'inventory')}
    </button>
  )
}

export function BackofficeCascadeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">{children}</div>
  )
}

export function BackofficeCascadePanel({
  title,
  subtitle,
  children,
  className = 'lg:col-span-3',
  onBack,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  onBack?: () => void
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <aside
      className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 text-xs font-bold uppercase tracking-wider text-red-600 lg:hidden"
            >
              ← {tCommon(locale, 'back')}
            </button>
          ) : null}
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </aside>
  )
}

export function BackofficeCascadeListButton({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
        active
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-transparent bg-neutral-50 text-neutral-800 hover:border-neutral-200 hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}
