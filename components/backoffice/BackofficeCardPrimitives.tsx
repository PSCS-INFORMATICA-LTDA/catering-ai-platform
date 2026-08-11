'use client'

import type { ReactNode } from 'react'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export function BackofficeCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  )
}

export function BackofficeEmptyState({
  loading,
  message,
}: {
  loading?: boolean
  message?: string
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center shadow-sm">
      <p className="text-sm text-neutral-500">
        {loading
          ? tCommon(locale, 'loading')
          : message || tCommon(locale, 'empty')}
      </p>
    </div>
  )
}

export function BackofficeStatusBadge({ active }: { active: boolean }) {
  const locale = useAuthLocaleFromMe()
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200'
      }`}
    >
      {active ? tCommon(locale, 'active') : tCommon(locale, 'inactive')}
    </span>
  )
}

export function BackofficeAccentBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      {children}
    </span>
  )
}

export function BackofficeOpenQuoteBadge({ count }: { count: number }) {
  const locale = useAuthLocaleFromMe()
  if (count <= 0) return null
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
      {count > 1
        ? tCommon(locale, 'openQuotesCount', { count })
        : tCommon(locale, 'openQuote')}
    </span>
  )
}

export function BackofficeMetaRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <p className="text-sm text-neutral-600">
      <span className="font-semibold text-neutral-800">{label}:</span>{' '}
      <span className="text-neutral-700">{value}</span>
    </p>
  )
}

export function BackofficeEntityCard({
  image,
  inactive = false,
  editing = false,
  children,
  actions,
  className = '',
}: {
  image?: ReactNode
  inactive?: boolean
  editing?: boolean
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
        editing
          ? 'border-red-200 ring-2 ring-red-100'
          : 'border-neutral-200'
      } ${inactive ? 'opacity-60' : ''} ${className}`}
    >
      {image}
      <div className="space-y-3 p-5">{children}</div>
      {actions ? (
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-4">
          {actions}
        </div>
      ) : null}
    </article>
  )
}

export function BackofficeFormCard({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  return (
    <article className="col-span-full overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm ring-2 ring-red-50">
      <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-4">
        <h2 className="text-lg font-bold text-red-600">{title}</h2>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      <div className="flex flex-wrap gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-4">
        {actions}
      </div>
    </article>
  )
}

export function BackofficeField({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100'

export function BackofficeInput({
  type = 'text',
  value,
  onChange,
  disabled,
}: {
  type?: string
  value: string | number | boolean | null | undefined
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value == null ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  )
}

export function BackofficeSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {children}
    </select>
  )
}

export function BackofficeBtnPrimary({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function BackofficeBtnSecondary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function BackofficeBtnOutline({
  children,
  onClick,
  disabled,
  accent = false,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[40px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold shadow-sm transition disabled:opacity-50 ${
        accent
          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  )
}

export function BackofficeBtnDanger({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function BackofficeCardImage({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-neutral-50">
      {children}
    </div>
  )
}
