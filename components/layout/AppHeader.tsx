'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTenant } from '@/components/tenant/TenantProvider'
import { glassBtn } from '@/Lib/liquidGlass'
import { createClient } from '@/Lib/supabase/client'
import { resolveAuthLocale, tAuth } from '@/Lib/i18n/authUsers'

type MeResponse = {
  email?: string | null
  displayName?: string | null
  isPlatformAdmin?: boolean
  locale?: string
}

export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter()
  const { company, loading } = useTenant()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as MeResponse
      if (!cancelled) setMe(data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const locale = resolveAuthLocale(me?.locale)
  const companyLabel =
    company?.trade_name?.trim() ||
    company?.company_name?.trim() ||
    (loading ? '…' : 'Empresa')

  return (
    <header className="catering-app-header flex shrink-0 items-center gap-3 border-b border-cdl-border px-3 py-2.5 sm:px-4">
      {/* Só mobile — no desktop o menu lateral já fica aberto (padrão Logistics). */}
      <button
        type="button"
        className="catering-header-menu-btn"
        aria-label="Abrir menu"
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
          Empresa
        </p>
        <p className="truncate text-sm font-bold text-cdl-title">
          <span className="text-cdl-muted font-semibold">EMPRESA:</span>{' '}
          <span className="text-amber-600">{companyLabel}</span>
        </p>
      </div>

      <div className="hidden min-w-0 text-right text-xs text-cdl-muted sm:block">
        <p className="truncate font-semibold text-cdl-fg">
          {me?.displayName || me?.email || '…'}
        </p>
        {me?.isPlatformAdmin ? (
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
