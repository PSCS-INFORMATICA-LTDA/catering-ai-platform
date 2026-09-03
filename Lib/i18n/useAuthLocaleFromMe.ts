'use client'

import { useEffect } from 'react'
import { useOptionalAppSession } from '@/components/auth/AppSessionProvider'
import { resolveAuthLocale, type AuthLocale } from '@/Lib/i18n/authUsers'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocale } from '@/Lib/i18n/useAuthLocale'

/**
 * Locale de UI a partir do bootstrap autenticado (AppSessionProvider).
 * NÃO chama `/api/auth/me` no caminho normal — isso gerava uma tempestade
 * de requests (um por componente hidratado).
 */
export function useAuthLocaleFromMe(
  initial?: string | null,
  options: { disabled?: boolean } = {},
): AuthLocale {
  const session = useOptionalAppSession()
  const sessionLocale = options.disabled ? null : session?.locale
  const { locale, setLocale } = useAuthLocale(sessionLocale ?? initial)

  useEffect(() => {
    if (options.disabled) return
    if (sessionLocale) {
      setLocale(resolveAuthLocale(sessionLocale))
      return
    }
    try {
      const stored = window.localStorage.getItem('catering.auth.locale')
      if (stored) setLocale(resolveAuthLocale(stored))
    } catch {
      /* ignore */
    }
  }, [options.disabled, sessionLocale, setLocale])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = toBcp47Locale(locale)
  }, [locale])

  return locale
}
