'use client'

import { useEffect } from 'react'
import { resolveAuthLocale, type AuthLocale } from '@/Lib/i18n/authUsers'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocale } from '@/Lib/i18n/useAuthLocale'

/**
 * Locale de UI resolvido via `/api/auth/me` (`app_users.preferred_language`).
 * Mesmo padrão usado em `app/users/page.tsx`: parte de `pt` (ou `initial`) no
 * primeiro paint e atualiza assim que a sessão responde, para evitar
 * mismatch de hidratação.
 */
export function useAuthLocaleFromMe(initial?: string | null): AuthLocale {
  const { locale, setLocale } = useAuthLocale(initial)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const json = (await res.json().catch(() => null)) as
          | { locale?: string }
          | null
        if (cancelled || !json?.locale) return
        setLocale(resolveAuthLocale(json.locale))
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [setLocale])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = toBcp47Locale(locale)
  }, [locale])

  return locale
}
