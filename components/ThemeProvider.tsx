'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

export type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'cdl-theme'

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    if (window.location.pathname.startsWith('/quote/')) return
    const initial = getPreferredTheme()
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    if (document.documentElement.getAttribute('data-public-wizard-theme') === 'light-locked') {
      return
    }
    if (window.location.pathname.startsWith('/quote/')) return
    setThemeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    if (document.documentElement.getAttribute('data-public-wizard-theme') === 'light-locked') {
      return
    }
    if (window.location.pathname.startsWith('/quote/')) return
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, next)
      applyTheme(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
