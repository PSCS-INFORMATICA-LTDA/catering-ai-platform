'use client'

import type { ReactNode } from 'react'
import { tCommon } from '@/Lib/i18n/common'
import { tCommercialRules } from '@/Lib/i18n/commercialRules'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { getPackageCascadeFriendlyLabel } from '@/Lib/packageDisplay'
import {
  getPackageKey,
  type PackageFieldSource,
} from '@/Lib/packageFieldAccess'

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function PremiumMetricCard({
  label,
  value,
  hint,
  accent = 'default',
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: 'default' | 'red' | 'gold' | 'green'
}) {
  const accentClass =
    accent === 'red'
      ? 'border-red-100 bg-gradient-to-br from-red-50 to-white'
      : accent === 'gold'
        ? 'border-amber-100 bg-gradient-to-br from-amber-50/80 to-white'
        : accent === 'green'
          ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white'
          : 'border-neutral-200 bg-white'

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${accentClass}`}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-neutral-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  )
}

export function PremiumChip({
  active,
  children,
  onClick,
  badge,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  badge?: ReactNode
}) {
  const className = `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
    active
      ? 'border-red-300 bg-red-50 text-red-700 shadow-sm'
      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
        {badge}
      </button>
    )
  }

  return (
    <span className={className}>
      {children}
      {badge}
    </span>
  )
}

export function PackageCodeOption({
  pkg,
  active,
  onClick,
  hideTechnical = false,
  selectionTone = 'default',
}: {
  pkg: PackageFieldSource
  active?: boolean
  onClick: () => void
  hideTechnical?: boolean
  selectionTone?: 'default' | 'brand'
}) {
  const locale = useAuthLocaleFromMe()
  const code = getPackageKey(pkg) || '—'
  const withSides = code.endsWith('+')
  const friendlyLabel = getPackageCascadeFriendlyLabel(pkg)

  const activeClass =
    selectionTone === 'brand'
      ? 'border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] shadow-sm ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_28%,transparent)]'
      : 'border-red-400 bg-red-50 shadow-sm ring-2 ring-red-200'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? activeClass
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      {!hideTechnical ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500">
            {code}
          </span>
          {withSides ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {tCommon(locale, 'plusSides')}
            </span>
          ) : null}
        </div>
      ) : withSides ? (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
          {tCommon(locale, 'withSides')}
        </span>
      ) : null}
      <p
        className={`${hideTechnical ? '' : 'mt-2 '}text-lg font-extrabold tracking-tight text-neutral-900`}
      >
        {friendlyLabel}
      </p>
    </button>
  )
}

function premiumGroupHasSides(title: string): boolean {
  const normalized = title.toLowerCase()
  return (
    normalized.includes('with side') ||
    normalized.includes('com guarni') ||
    normalized.includes('con guarni')
  )
}

export function PremiumGroupBlock({
  title,
  count,
  summary,
  active,
  onClick,
  children,
}: {
  title: string
  count: number
  summary?: string
  active?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const locale = useAuthLocaleFromMe()
  const withSides = premiumGroupHasSides(title)
  const countLabel =
    count === 1 ? tCommon(locale, 'packageSingular') : tCommon(locale, 'packages')
  const badgeLabel = withSides
    ? tCommon(locale, 'withSides')
    : tCommon(locale, 'withoutSides')

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
        active
          ? 'border-red-300 bg-gradient-to-br from-red-50 to-white ring-2 ring-red-100'
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-neutral-900">{title}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {count} {countLabel}
          </p>
          {summary ? (
            <p className="mt-2 line-clamp-2 text-xs text-neutral-400">{summary}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            withSides
              ? 'bg-amber-50 text-amber-800'
              : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {badgeLabel}
        </span>
      </div>
      {children}
    </button>
  )
}

export function PriceBreakdownCard({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode; emphasis?: boolean }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`rounded-xl border px-4 py-3 ${
            row.emphasis
              ? 'border-red-200 bg-red-50/60'
              : 'border-neutral-200 bg-neutral-50/80'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            {row.label}
          </p>
          <p
            className={`mt-1 text-lg font-black ${
              row.emphasis ? 'text-red-600' : 'text-neutral-900'
            }`}
          >
            {row.value}
          </p>
        </div>
      ))}
    </div>
  )
}

export function ExpandableDescription({
  label,
  text,
  emptyLabel = '—',
}: {
  label: string
  text: string | null | undefined
  emptyLabel?: string
}) {
  const locale = useAuthLocaleFromMe()
  const content = text?.trim() || emptyLabel
  const isLong = content.length > 140

  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
      <p className="text-sm font-bold text-neutral-900">{label}</p>
      <p
        className={`mt-2 text-sm leading-relaxed text-neutral-700 ${
          isLong ? 'line-clamp-4 group-open:line-clamp-none' : ''
        }`}
      >
        {content}
      </p>
      {isLong ? (
        <details className="mt-2 text-xs font-bold text-red-600">
          <summary className="cursor-pointer select-none">
            {tCommon(locale, 'seeFullText')}
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">{content}</p>
        </details>
      ) : null}
    </div>
  )
}

export function PremiumCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function StatusBadge({
  active,
  label,
}: {
  active: boolean
  label?: string
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
          : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200'
      }`}
    >
      {label ?? (active ? tCommon(locale, 'active') : tCommon(locale, 'inactive'))}
    </span>
  )
}

export function EmptyImagePlaceholder({
  label,
  className = '',
}: {
  label?: string
  className?: string
}) {
  const locale = useAuthLocaleFromMe()
  const resolved = label ?? tCommon(locale, 'noImageRegistered')
  return (
    <div
      className={`flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 text-center ${className}`}
      role="img"
      aria-label={resolved}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 sm:text-xs">
        {resolved}
      </span>
    </div>
  )
}

export function CategoryAccordion({
  title,
  subtitle,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  count?: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-neutral-50/80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-lg font-bold text-neutral-900">{title}</span>
            {count != null ? (
              <span className="text-sm text-neutral-500">
                {count}{' '}
                {count === 1
                  ? tCommon(locale, 'itemSingular')
                  : tCommon(locale, 'items')}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm text-red-600">{open ? '▲' : '▼'}</span>
      </button>
      {open ? <div className="border-t border-neutral-100 p-4">{children}</div> : null}
    </section>
  )
}

export function RuleGroupAccordion({
  category,
  count,
  open,
  onToggle,
  children,
}: {
  category: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const locale = useAuthLocaleFromMe()
  const label =
    count === 1
      ? tCommercialRules(locale, 'ruleSingular')
      : tCommercialRules(locale, 'rulesPlural')
  return (
    <CategoryAccordion
      title={category}
      subtitle={tCommercialRules(locale, 'rulesCount', { count, label })}
      count={count}
      open={open}
      onToggle={onToggle}
    >
      {children}
    </CategoryAccordion>
  )
}
