'use client'

import {
  getGarnishBadgeClasses,
  getPackageBadgeClasses,
  resolvePackageBadgeTheme,
} from '@/Lib/packageBadgeTheme'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export default function PackageBadge({
  name,
  compact = false,
  className = '',
}: {
  name: string | null
  compact?: boolean
  className?: string
}) {
  const locale = useAuthLocaleFromMe()
  const theme = resolvePackageBadgeTheme(name)
  const styles = getPackageBadgeClasses(theme.tier)
  const garnish = getGarnishBadgeClasses()

  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex max-w-full items-center rounded-full border ${styles.border} ${styles.bg} ${styles.text} ${styles.weight} uppercase tracking-wider ${
          compact
            ? 'px-2.5 py-1 text-[0.58rem]'
            : 'px-3 py-1.5 text-[0.65rem]'
        }`}
      >
        <span className="truncate">
          {tPackages(locale, 'packagePrefix', { label: theme.displayLabel })}
        </span>
      </span>
      {theme.hasSides ? (
        <span
          className={`inline-flex shrink-0 items-center rounded-full border ${garnish.border} ${garnish.bg} ${garnish.text} font-black uppercase tracking-wider ${
            compact ? 'px-2 py-0.5 text-[0.52rem]' : 'px-2.5 py-1 text-[0.58rem]'
          }`}
        >
          {tPackages(locale, 'withGarnish')}
        </span>
      ) : null}
    </span>
  )
}
