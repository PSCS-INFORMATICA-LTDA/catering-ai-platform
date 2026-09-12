'use client'

import Link from 'next/link'
import { tFinanceControl } from '@/Lib/i18n/financeControl'

export function FinanceBreadcrumb({
  locale,
  current,
}: {
  locale: string
  current: string
}) {
  return (
    <nav aria-label={tFinanceControl(locale, 'breadcrumbFinance')} className="text-xs font-bold uppercase tracking-[0.16em] text-cdl-muted">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/finance" className="text-[var(--brand-primary-2)] hover:underline">
            {tFinanceControl(locale, 'breadcrumbFinance')}
          </Link>
        </li>
        <li aria-hidden>›</li>
        <li className="text-cdl-fg">{current}</li>
      </ol>
    </nav>
  )
}

export function FinanceBackLink({ locale }: { locale: string }) {
  return (
    <Link
      href="/finance"
      className="inline-flex min-h-[44px] items-center text-xs font-black uppercase tracking-wider text-[var(--brand-primary-2)] hover:underline"
    >
      {tFinanceControl(locale, 'backToFinance')}
    </Link>
  )
}

export function FinanceEnvBadges({
  locale,
  companyName,
  appEnvironment,
  paypalSandbox,
}: {
  locale: string
  companyName?: string | null
  appEnvironment?: 'DEV' | 'PROD' | string | null
  paypalSandbox?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {companyName ? (
        <span className="rounded-full border border-cdl-border bg-cdl-surface px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cdl-fg">
          {tFinanceControl(locale, 'activeCompany')}: {companyName}
        </span>
      ) : null}
      {appEnvironment !== 'PROD' ? (
        <span className="rounded-full border-2 border-cdl-accent bg-cdl-accent px-3 py-1 text-[11px] font-black tracking-[0.18em] text-black">
          {tFinanceControl(locale, 'environmentDev')}
        </span>
      ) : null}
      {paypalSandbox ? (
        <span className="rounded-full border-2 border-amber-400 bg-amber-100 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-amber-950">
          {tFinanceControl(locale, 'paypalSandbox')}
        </span>
      ) : null}
    </div>
  )
}

export function FinanceErrorState({
  locale,
  message,
  onRetry,
}: {
  locale: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="liquid-glass-card space-y-3 p-5" role="alert">
      <p className="text-sm font-bold text-red-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 text-xs font-black uppercase tracking-wider"
        >
          {tFinanceControl(locale, 'retry')}
        </button>
      ) : null}
    </div>
  )
}

export function FinanceSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl bg-cdl-surface" />
      ))}
    </div>
  )
}
