'use client'

import { useCallback, useState } from 'react'
import { resolveAuthLocale, type AuthLocale } from '@/Lib/i18n/authUsers'

const STORAGE_KEY = 'catering.auth.locale'

/**
 * Locale UI state. Defaults to `pt` (or `initial`) on first paint to avoid
 * localStorage hydration mismatches; persistence is write-through only.
 */
export function useAuthLocale(initial?: string | null): {
  locale: AuthLocale
  setLocale: (locale: AuthLocale) => void
} {
  const [locale, setLocaleState] = useState<AuthLocale>(() =>
    resolveAuthLocale(initial),
  )

  const setLocale = useCallback((next: AuthLocale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  return { locale, setLocale }
}
