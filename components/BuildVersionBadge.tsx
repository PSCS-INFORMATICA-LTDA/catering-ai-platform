'use client'

import { getBuildInfo } from '@/Lib/buildInfo'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export default function BuildVersionBadge({
  className = '',
}: {
  className?: string
}) {
  const build = getBuildInfo()
  const locale = useAuthLocaleFromMe()

  return (
    <p
      className={`text-[11px] leading-snug text-cdl-muted ${className}`}
      title={`Build ${build.label} · ${build.timeIso} · ${build.shortSha}`}
    >
      {tCommon(locale, 'updatedAt')}: {build.displayTime} — {build.note} ·{' '}
      {tCommon(locale, 'version')} {build.label}
      {build.shortSha !== 'local' ? ` · ${build.shortSha}` : ''}
    </p>
  )
}
