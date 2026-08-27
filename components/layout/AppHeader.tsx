'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAppSession } from '@/components/auth/AppSessionProvider'
import { useTenant } from '@/components/tenant/TenantProvider'
import { glassBtn } from '@/Lib/liquidGlass'
import { createClient } from '@/Lib/supabase/client'
import { resolveAuthLocale, tAuth } from '@/Lib/i18n/authUsers'
import { tChrome } from '@/Lib/i18n/chrome'
import { resolveTenantCompanyDisplayName } from '@/Lib/tenant/companyDisplayName'

export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter()
  const { session } = useAppSession()
  const { company, loading } = useTenant()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
      router.replace('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  const locale = resolveAuthLocale(session?.locale)
  const resolvedCompanyName = resolveTenantCompanyDisplayName(company)
  const companyLabel = loading
    ? '…'
    : resolvedCompanyName ?? tChrome(locale, 'headerCompanyUnidentified')

  return (
    <header className="catering-app-header flex shrink-0 items-center gap-3 border-b border-cdl-border px-3 py-2.5 sm:px-4">
      <button
        type="button"
        className="catering-header-menu-btn"
        aria-label={tChrome(locale, 'headerOpenMenu')}
        onClick={onMenuClick}
      >
        <span className="catering-header-menu-icon" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-cdl-muted">
          {tChrome(locale, 'headerCompany')}
        </p>
        <p className="truncate text-sm font-bold text-cdl-title">
          <span className="text-cdl-muted font-semibold">
            {tChrome(locale, 'headerCompanyPrefix')}
          </span>{' '}
          <span className="text-amber-600">{companyLabel}</span>
        </p>
      </div>

      <div className="hidden min-w-0 text-right text-xs text-cdl-muted sm:block">
        <p className="truncate font-semibold text-cdl-fg">
          {session?.displayName || session?.email || '…'}
        </p>
        {session?.isPlatformAdmin ? (
          <p className="text-[0.65rem] uppercase tracking-wider">
            {tAuth(locale, 'platformAdmin')}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={loggingOut}
        onClick={() => void logout()}
        className={glassBtn('primary', 'liquid-glass-tab-link--plain shrink-0')}
      >
        {tAuth(locale, 'logout')}
      </button>
    </header>
  )
}
