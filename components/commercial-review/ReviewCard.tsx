import type { ReactNode } from 'react'

export function ReviewCard({
  title,
  testId,
  children,
  highlight = false,
}: {
  title: string
  testId: string
  children: ReactNode
  highlight?: boolean
}) {
  return (
    <section
      id={testId}
      data-testid={testId}
      className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${
        highlight
          ? 'border-amber-200 bg-amber-50/70'
          : 'border-cdl-border bg-cdl-surface'
      }`}
    >
      <h2 className="text-xs font-black uppercase tracking-[0.16em] text-cdl-muted">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function ReviewField({
  label,
  value,
  large = false,
  testId,
}: {
  label: string
  value: ReactNode
  large?: boolean
  testId?: string
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-cdl-muted">
        {label}
      </dt>
      <dd
        data-testid={testId}
        className={`mt-1 break-words text-cdl-title ${
          large ? 'text-2xl font-black tabular-nums' : 'text-sm font-semibold'
        }`}
      >
        {value === 0 || value ? value : '—'}
      </dd>
    </div>
  )
}
